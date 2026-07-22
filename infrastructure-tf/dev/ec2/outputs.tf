output "frontend_instance_id" {
  description = "Frontend EC2 instance ID."
  value       = aws_instance.frontend.id
}

output "frontend_public_ip" {
  description = "Frontend Elastic IP."
  value       = aws_eip.frontend.public_ip
}

output "backend_instance_id" {
  description = "Backend EC2 instance ID."
  value       = aws_instance.backend.id
}

output "backend_private_ip" {
  description = "Backend private IPv4 address."
  value       = aws_instance.backend.private_ip
}
