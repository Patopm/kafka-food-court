# Terraform Deployment (AWS)

This folder provisions AWS resources for the monorepo deployment:

- one EC2 host (Ubuntu)
- Elastic IP
- security group with ports for web and Kafka external listener
- IAM role/profile for SSM access
- cloud-init/user-data bootstrap that installs and starts:
  - Kafka
  - Client app (`:3000`)
  - Dashboard app (`:3002`)
  - Multiple published Kitchen app instances (`:3101+`)

## Rollback model

Rollback is input-driven:

- `app_git_ref` controls deployed code version (branch/tag/SHA).
- To rollback, set `app_git_ref` to a previous commit/tag and run `terraform plan` + `terraform apply` later.

## Kitchen publishing model

- Kitchen UIs are published at `/kitchens/<kitchen-id>/`.
- Access is restricted by `kitchen_ui_allowed_cidrs`.
- Multiple examples are controlled by `kitchen_instances`.

## Files

- `versions.tf`, `providers.tf`: Terraform/AWS provider setup
- `variables.tf`: deployment inputs
- `main.tf`: AWS resources
- `outputs.tf`: useful endpoints
- `terraform.tfvars.example`: sample values
- `templates/user_data.sh.tftpl`: host bootstrap logic

## Usage (no apply here)

```bash
cd infra/terraform
terraform init
cp terraform.tfvars.example terraform.tfvars
# edit terraform.tfvars
terraform plan
# intentionally skip apply in this repository task
```

## Low-cost settings (free-tier oriented)

- `instance_type = "t3.micro"` (default)
- `volume_size_gb = 20` (default)
- `enable_kafka_ui = false`
- keep `kitchen_instances` small (for example `["kitchen-a", "kitchen-b"]`)

Important: Kafka + multiple Next apps can be heavy for `t3.micro`. If performance is poor, temporarily use `t3.small` and destroy after the demo.

## Important

- Restrict `kitchen_allowed_cidrs` to your own public IP(s).
- If you expose SSH, restrict `ssh_allowed_cidrs` tightly.
- The bootstrap script uses plain HTTP by default; add TLS (Route53 + ACM + ALB or certbot) as a next step.
