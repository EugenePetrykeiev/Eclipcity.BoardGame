output "ebs_key_arn" {
  description = "KMS key ARN used by EC2 root volumes."
  value       = aws_kms_key.ebs.arn
}
