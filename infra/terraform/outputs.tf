output "instance_id" {
  description = "EC2 instance id"
  value       = aws_instance.app.id
}

output "public_ip" {
  description = "Elastic IP to configure DNS records"
  value       = aws_eip.app.public_ip
}

output "public_dns" {
  description = "Public DNS name for quick access"
  value       = aws_instance.app.public_dns
}

output "kafka_broker_for_kitchens" {
  description = "Set this in local kitchen .env.local as KAFKA_BROKER"
  value       = "${aws_eip.app.public_ip}:29092"
}

output "published_kitchen_urls" {
  description = "Published kitchen demo routes (access restricted by kitchen_ui_allowed_cidrs)"
  value       = [for kitchen in var.kitchen_instances : "http://${aws_eip.app.public_ip}/kitchens/${kitchen}/"]
}
