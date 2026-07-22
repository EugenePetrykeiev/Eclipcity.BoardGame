resource "aws_security_group" "frontend" {
  name_prefix            = "${var.name_prefix}-frontend-"
  description            = "Public HTTP/S entry point for ${var.name_prefix}"
  vpc_id                 = var.vpc_id
  revoke_rules_on_delete = true

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-frontend"
    Role = "frontend"
  })

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_vpc_security_group_ingress_rule" "frontend_http" {
  security_group_id = aws_security_group.frontend.id
  description       = "Public HTTP for ACME and redirect"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 80
  ip_protocol       = "tcp"
  to_port           = 80
}

resource "aws_vpc_security_group_ingress_rule" "frontend_https" {
  security_group_id = aws_security_group.frontend.id
  description       = "Public HTTPS application traffic"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  ip_protocol       = "tcp"
  to_port           = 443
}

resource "aws_vpc_security_group_egress_rule" "frontend_all" {
  security_group_id = aws_security_group.frontend.id
  description       = "Outbound dependencies, package registries, and private backend"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_security_group" "backend" {
  name_prefix            = "${var.name_prefix}-backend-"
  description            = "Private backend for ${var.name_prefix}"
  vpc_id                 = var.vpc_id
  revoke_rules_on_delete = true

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-backend"
    Role = "backend"
  })

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_vpc_security_group_ingress_rule" "backend_from_frontend" {
  security_group_id            = aws_security_group.backend.id
  description                  = "Backend API only from the frontend reverse proxy"
  referenced_security_group_id = aws_security_group.frontend.id
  from_port                    = var.backend_port
  ip_protocol                  = "tcp"
  to_port                      = var.backend_port
}

resource "aws_vpc_security_group_egress_rule" "backend_all" {
  security_group_id = aws_security_group.backend.id
  description       = "Outbound AWS APIs, OAuth, SES, package registries, and existing DB"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_vpc_peering_connection" "database" {
  vpc_id      = var.vpc_id
  peer_vpc_id = var.database_vpc_id
  auto_accept = true

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-database"
  })
}

resource "aws_vpc_peering_connection_options" "database" {
  vpc_peering_connection_id = aws_vpc_peering_connection.database.id

  requester {
    allow_remote_vpc_dns_resolution = true
  }

  accepter {
    allow_remote_vpc_dns_resolution = true
  }
}

resource "aws_route" "backend_to_database" {
  route_table_id            = var.private_route_table_id
  destination_cidr_block    = var.database_vpc_cidr
  vpc_peering_connection_id = aws_vpc_peering_connection.database.id
}

resource "aws_route" "database_to_backend" {
  route_table_id            = var.database_route_table_id
  destination_cidr_block    = var.vpc_cidr
  vpc_peering_connection_id = aws_vpc_peering_connection.database.id
}

resource "aws_vpc_security_group_ingress_rule" "database_from_backend" {
  security_group_id            = var.database_security_group_id
  description                  = "PostgreSQL only from the ${var.name_prefix} backend"
  referenced_security_group_id = aws_security_group.backend.id
  from_port                    = var.database_port
  ip_protocol                  = "tcp"
  to_port                      = var.database_port

  depends_on = [aws_vpc_peering_connection_options.database]
}
