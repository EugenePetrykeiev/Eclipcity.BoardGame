output "dns_records" {
  description = "DNS records required to verify SES identity, DKIM, and custom MAIL FROM."
  value = concat(
    local.verification_records,
    local.dkim_records,
    local.mail_from_records,
  )
}

output "identity_arn" {
  description = "SES domain identity ARN, or null when SES is disabled."
  value       = var.enabled ? aws_ses_domain_identity.this[0].arn : null
}
