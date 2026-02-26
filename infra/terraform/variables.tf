variable "project_name" {
  description = "Name prefix for AWS resources"
  type        = string
  default     = "kafka-food-court"
}

variable "aws_region" {
  description = "AWS region where resources are created"
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "AWS CLI/profile name used by Terraform AWS provider"
  type        = string
  default     = "personal"
}

variable "vpc_id" {
  description = "VPC ID where the instance will run"
  type        = string
}

variable "subnet_id" {
  description = "Public subnet ID for the EC2 instance"
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro"
}

variable "ssh_key_name" {
  description = "Existing EC2 Key Pair name for SSH access"
  type        = string
  default     = null
}

variable "ssh_allowed_cidrs" {
  description = "CIDR blocks allowed to SSH to the EC2 host"
  type        = list(string)
  default     = []
}

variable "kitchen_allowed_cidrs" {
  description = "CIDR blocks allowed to access Kafka external port 29092"
  type        = list(string)
}

variable "kitchen_ui_allowed_cidrs" {
  description = "CIDR blocks allowed to access published kitchen UI routes"
  type        = list(string)
}

variable "kitchen_instances" {
  description = "Kitchen instance identifiers to publish as examples"
  type        = list(string)
  default     = ["kitchen-a", "kitchen-b"]

  validation {
    condition     = length(var.kitchen_instances) > 0
    error_message = "kitchen_instances must contain at least one kitchen identifier."
  }

  validation {
    condition     = alltrue([for id in var.kitchen_instances : can(regex("^[a-z0-9-]+$", id))])
    error_message = "kitchen_instances values must match ^[a-z0-9-]+$."
  }
}

variable "kafka_ui_allowed_cidrs" {
  description = "CIDR blocks allowed to access Kafka UI port 8080"
  type        = list(string)
  default     = []
}

variable "repo_url" {
  description = "Git URL for this monorepo"
  type        = string
}

variable "app_git_ref" {
  description = "Git branch, tag, or commit SHA to deploy. Change this for rollback/roll-forward."
  type        = string
  default     = "main"
}

variable "enable_kafka_ui" {
  description = "Whether to expose Kafka UI on port 8080"
  type        = bool
  default     = false
}

variable "volume_size_gb" {
  description = "Root EBS volume size in GB"
  type        = number
  default     = 20
}

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
