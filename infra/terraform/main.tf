data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

locals {
  common_tags = merge(
    {
      Project     = var.project_name
      ManagedBy   = "Terraform"
      Environment = "production"
    },
    var.tags
  )

  kitchen_allow_directives = join("\n", [for cidr in var.kitchen_ui_allowed_cidrs : "    allow ${cidr};"])

  kitchen_nginx_locations = join("\n\n", [
    for idx, kitchen in var.kitchen_instances : <<-EOT
      location /kitchens/${kitchen} {
        ${local.kitchen_allow_directives}
        deny all;
        proxy_pass http://127.0.0.1:${3101 + idx};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600;
        add_header X-Accel-Buffering no;
      }
    EOT
  ])

  kitchen_build_commands = join("\n", [
    for kitchen in var.kitchen_instances : <<-EOT
      sudo -u ubuntu bash -lc 'cd /opt/kafka-food-court/apps/kitchen-app && KITCHEN_BASE_PATH=/kitchens/${kitchen} KITCHEN_DIST_DIR=.next-${kitchen} NODE_OPTIONS=--max-old-space-size=512 bun run build || (sleep 10 && KITCHEN_BASE_PATH=/kitchens/${kitchen} KITCHEN_DIST_DIR=.next-${kitchen} NODE_OPTIONS=--max-old-space-size=512 bun run build)'
    EOT
  ])

  kitchen_systemd_units = join("\n\n", [
    for idx, kitchen in var.kitchen_instances : <<-EOT
      cat > /etc/systemd/system/kfc-${kitchen}.service <<'UNIT'
      [Unit]
      Description=Kafka Food Court Kitchen App (${kitchen})
      After=network.target docker.service

      [Service]
      Type=simple
      User=ubuntu
      WorkingDirectory=/opt/kafka-food-court/apps/kitchen-app
      Environment=PATH=/usr/local/bin:/usr/bin:/bin:/home/ubuntu/.bun/bin
      Environment=KAFKA_BROKER=$${PUBLIC_IP}:29092
      Environment=DB_FILE_PATH=/opt/kafka-food-court/data/food-court-db.json
      Environment=KITCHEN_ID=${kitchen}
      Environment=NEXT_PUBLIC_KITCHEN_NAME=${kitchen}
      Environment=KITCHEN_BASE_PATH=/kitchens/${kitchen}
      Environment=KITCHEN_DIST_DIR=.next-${kitchen}
      ExecStart=/home/ubuntu/.bun/bin/bunx next start -p ${3101 + idx}
      Restart=always
      RestartSec=5

      [Install]
      WantedBy=multi-user.target
      UNIT
    EOT
  ])

  kitchen_service_names = join(" ", [for kitchen in var.kitchen_instances : "kfc-${kitchen}"])
  kitchen_urls          = [for kitchen in var.kitchen_instances : "/kitchens/${kitchen}/"]
}

resource "aws_iam_role" "ec2_role" {
  name = "${var.project_name}-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "ec2_profile" {
  name = "${var.project_name}-ec2-profile"
  role = aws_iam_role.ec2_role.name

  tags = local.common_tags
}

resource "aws_security_group" "app" {
  name        = "${var.project_name}-sg"
  description = "Security group for Kafka Food Court host"
  vpc_id      = var.vpc_id

  dynamic "ingress" {
    for_each = length(var.ssh_allowed_cidrs) > 0 ? [1] : []
    content {
      description = "SSH"
      from_port   = 22
      to_port     = 22
      protocol    = "tcp"
      cidr_blocks = var.ssh_allowed_cidrs
    }
  }

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Kafka external listener"
    from_port   = 29092
    to_port     = 29092
    protocol    = "tcp"
    cidr_blocks = var.kitchen_allowed_cidrs
  }

  dynamic "ingress" {
    for_each = var.enable_kafka_ui && length(var.kafka_ui_allowed_cidrs) > 0 ? [1] : []
    content {
      description = "Kafka UI"
      from_port   = 8080
      to_port     = 8080
      protocol    = "tcp"
      cidr_blocks = var.kafka_ui_allowed_cidrs
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.common_tags
}

resource "aws_instance" "app" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.instance_type
  subnet_id                   = var.subnet_id
  vpc_security_group_ids      = [aws_security_group.app.id]
  key_name                    = var.ssh_key_name
  iam_instance_profile        = aws_iam_instance_profile.ec2_profile.name
  associate_public_ip_address = true
  user_data_replace_on_change = true

  root_block_device {
    volume_size           = var.volume_size_gb
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true
  }

  user_data = templatefile("${path.module}/templates/user_data.sh.tftpl", {
    repo_url                = var.repo_url
    app_git_ref             = var.app_git_ref
    enable_kafka_ui         = var.enable_kafka_ui
    kitchen_nginx_locations = local.kitchen_nginx_locations
    kitchen_build_commands  = local.kitchen_build_commands
    kitchen_systemd_units   = local.kitchen_systemd_units
    kitchen_service_names   = local.kitchen_service_names
  })

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-host"
  })
}

resource "aws_eip" "app" {
  domain   = "vpc"
  instance = aws_instance.app.id

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-eip"
  })
}
