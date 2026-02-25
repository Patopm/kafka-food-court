aws_region   = "mx-central-1"
project_name = "kafka-food-court"

# Use your existing VPC/public subnet IDs
vpc_id    = "vpc-0bf0257eba95e468e"
subnet_id = "subnet-0c88c6403fa0d867f"

instance_type = "t3.small"
ssh_key_name  = "remote-monitor"

# Restrict to your own public IP(s)
ssh_allowed_cidrs        = ["189.206.61.26/32"]
kitchen_allowed_cidrs    = ["189.206.61.26/32"]
kitchen_ui_allowed_cidrs = ["189.206.61.26/32"]

# Published kitchen examples (accessible at /kitchens/<name>/)
# Keep this small to reduce CPU/RAM usage and cost.
kitchen_instances = ["kitchen-a", "kitchen-b"]

# Optional: keep disabled to minimize resource usage and attack surface.
enable_kafka_ui        = false
kafka_ui_allowed_cidrs = ["189.206.61.26/32"]

repo_url    = "https://github.com/Patopm/kafka-food-court.git"
app_git_ref = "main"

volume_size_gb = 20

tags = {
  Owner = "team-food-court"
}
