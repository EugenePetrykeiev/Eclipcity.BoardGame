output "repository_urls" {
  description = "ECR repository URLs by application component."
  value       = { for component, repository in aws_ecr_repository.application : component => repository.repository_url }
}

output "github_promote_role_arn" {
  description = "OIDC role used only to promote validated dev images into production repositories."
  value       = aws_iam_role.github_promote.arn
}

output "github_deploy_role_arns" {
  description = "Role-scoped OIDC deployment roles."
  value       = { for role, resource in aws_iam_role.github_deploy : role => resource.arn }
}

output "ssm_document_names" {
  description = "Role-specific SSM deployment documents."
  value = {
    backend  = aws_ssm_document.backend.name
    frontend = aws_ssm_document.frontend.name
  }
}
