output "records" {
  description = "Complete desired DNS record manifest for the external DNS provider."
  value       = local.records
}

output "database_private_hostname" {
  description = "Private PostgreSQL hostname available inside the production VPC."
  value       = aws_route53_record.database.fqdn
}

output "backend_private_hostname" {
  description = "Private backend hostname available inside the production VPC."
  value       = aws_route53_record.backend.fqdn
}
