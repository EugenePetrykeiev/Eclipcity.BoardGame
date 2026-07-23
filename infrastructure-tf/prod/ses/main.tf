resource "aws_ses_domain_identity" "this" {
  count = var.enabled ? 1 : 0

  domain = var.domain_name
}

resource "aws_ses_domain_dkim" "this" {
  count = var.enabled ? 1 : 0

  domain = aws_ses_domain_identity.this[0].domain
}

resource "aws_ses_domain_mail_from" "this" {
  count = var.enabled ? 1 : 0

  domain           = aws_ses_domain_identity.this[0].domain
  mail_from_domain = "mail.${var.domain_name}"
}

locals {
  verification_records = var.enabled ? [
    {
      name  = "_amazonses.${var.domain_name}"
      type  = "TXT"
      ttl   = 600
      value = aws_ses_domain_identity.this[0].verification_token
    }
  ] : []

  dkim_records = var.enabled ? [
    for token in aws_ses_domain_dkim.this[0].dkim_tokens : {
      name  = "${token}._domainkey.${var.domain_name}"
      type  = "CNAME"
      ttl   = 600
      value = "${token}.dkim.amazonses.com"
    }
  ] : []

  mail_from_records = var.enabled ? [
    {
      name  = "mail.${var.domain_name}"
      type  = "MX"
      ttl   = 600
      value = "10 feedback-smtp.${var.aws_region}.amazonses.com"
    },
    {
      name  = "mail.${var.domain_name}"
      type  = "TXT"
      ttl   = 600
      value = "v=spf1 include:amazonses.com ~all"
    }
  ] : []
}
