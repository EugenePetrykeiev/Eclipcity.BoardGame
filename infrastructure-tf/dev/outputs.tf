output "aws_account_id" {
  description = "AWS account where the dev resources are managed."
  value       = data.aws_caller_identity.current.account_id
}

output "vpc_id" {
  description = "Dev VPC ID."
  value       = module.vpc.vpc_id
}

output "frontend_instance_id" {
  description = "Frontend/edge EC2 instance ID."
  value       = module.ec2.frontend_instance_id
}

output "frontend_public_ip" {
  description = "Stable Elastic IP to use in the application A record."
  value       = module.ec2.frontend_public_ip
}

output "backend_instance_id" {
  description = "Backend EC2 instance ID."
  value       = module.ec2.backend_instance_id
}

output "backend_private_ip" {
  description = "Backend private IPv4 address used by the frontend reverse proxy."
  value       = module.ec2.backend_private_ip
}

output "backend_public_ip" {
  description = "Ephemeral backend public IPv4 for outbound Internet access; never use it as the application upstream."
  value       = module.ec2.backend_public_ip
}

output "nat_gateway_public_ip" {
  description = "NAT Gateway public IP when explicitly enabled; null in cost-optimized dev."
  value       = module.vpc.nat_gateway_public_ip
}

output "monthly_budget_name" {
  description = "AWS Budget name."
  value       = module.budget.name
}

output "database_vpc_peering_connection_id" {
  description = "Peering connection between the dev VPC and the existing database VPC."
  value       = module.network.database_vpc_peering_connection_id
}

output "database_private_hostname" {
  description = "Set this value as POSTGRES_HOST in the dev backend secret after apply."
  value       = module.dns.database_private_hostname
}

output "backend_private_hostname" {
  description = "Stable private backend hostname used by frontend nginx."
  value       = module.dns.backend_private_hostname
}

output "ecr_repository_urls" {
  description = "ECR repositories used by automatic container delivery."
  value       = module.cicd.repository_urls
}

output "github_actions_role_arns" {
  description = "GitHub OIDC roles for image build and role-specific deployment."
  value = merge(
    { build = module.cicd.github_build_role_arn },
    module.cicd.github_deploy_role_arns,
  )
}

output "deployment_ssm_document_names" {
  description = "SSM documents invoked by GitHub Actions."
  value       = module.cicd.ssm_document_names
}

output "dns_records" {
  description = "Desired public DNS records reconciled by dev/dns/sync-records.sh through the adm.tools API."
  value       = module.dns.records
}

output "frontend_ssm_command" {
  description = "Connect to the frontend without opening SSH."
  value       = "aws ssm start-session --region ${var.aws_region} --target ${module.ec2.frontend_instance_id}"
}

output "backend_ssm_command" {
  description = "Connect to the backend without opening SSH."
  value       = "aws ssm start-session --region ${var.aws_region} --target ${module.ec2.backend_instance_id}"
}
