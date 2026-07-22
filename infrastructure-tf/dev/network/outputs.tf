output "frontend_security_group_id" {
  description = "Frontend security group ID."
  value       = aws_security_group.frontend.id
}

output "backend_security_group_id" {
  description = "Backend security group ID."
  value       = aws_security_group.backend.id
}

output "database_vpc_peering_connection_id" {
  description = "VPC peering connection used for private PostgreSQL traffic."
  value       = aws_vpc_peering_connection.database.id
}
