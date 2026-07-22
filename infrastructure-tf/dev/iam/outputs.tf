output "frontend_instance_profile_name" {
  description = "Frontend IAM instance profile name."
  value       = aws_iam_instance_profile.instance["frontend"].name
}

output "backend_instance_profile_name" {
  description = "Backend IAM instance profile name."
  value       = aws_iam_instance_profile.instance["backend"].name
}
