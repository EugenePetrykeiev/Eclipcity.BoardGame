locals {
  application_record = [
    {
      name  = var.domain_name
      type  = "A"
      ttl   = var.application_ttl
      value = var.application_ipv4
    }
  ]

  records = concat(local.application_record, var.additional_records)
}

resource "aws_route53_zone" "internal" {
  name = "internal.${var.domain_name}"

  vpc {
    vpc_id = var.private_vpc_id
  }

  tags = merge(var.tags, {
    Name = "${var.domain_name}-internal"
  })
}

resource "aws_route53_record" "database" {
  zone_id = aws_route53_zone.internal.zone_id
  name    = var.private_database_hostname
  type    = "A"
  ttl     = 60
  records = [var.database_private_ipv4]
}
