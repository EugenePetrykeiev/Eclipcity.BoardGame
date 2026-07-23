resource "aws_instance" "frontend" {
  ami                         = var.ami_id
  instance_type               = var.frontend_instance_type
  subnet_id                   = var.frontend_subnet_id
  vpc_security_group_ids      = [var.frontend_security_group_id]
  associate_public_ip_address = true
  iam_instance_profile        = var.frontend_instance_profile
  monitoring                  = var.enable_detailed_monitoring

  user_data = templatefile("${path.module}/user_data.sh.tftpl", {
    instance_role      = "frontend"
    aws_region         = var.aws_region
    domain_name        = var.domain_name
    backend_secret_arn = ""
  })

  user_data_replace_on_change = true

  root_block_device {
    encrypted             = true
    kms_key_id            = "alias/aws/ebs"
    volume_size           = var.root_volume_size_gb
    volume_type           = "gp3"
    delete_on_termination = true
  }

  lifecycle {
    # Existing encrypted root volumes cannot change KMS keys in place. Keep the
    # current volume; replacement instances still use the AWS-managed key above.
    ignore_changes = [root_block_device[0].kms_key_id]
  }

  metadata_options {
    http_endpoint               = "enabled"
    http_protocol_ipv6          = "disabled"
    http_put_response_hop_limit = 1
    http_tokens                 = "required"
    instance_metadata_tags      = "disabled"
  }

  maintenance_options {
    auto_recovery = "default"
  }

  credit_specification {
    cpu_credits = "standard"
  }

  volume_tags = merge(var.tags, {
    Name = "${var.name_prefix}-frontend-root"
    Role = "frontend"
  })

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-frontend"
    Role = "frontend"
  })
}

resource "aws_eip" "frontend" {
  domain = "vpc"

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-frontend"
    Role = "frontend"
  })
}

resource "aws_eip_association" "frontend" {
  allocation_id = aws_eip.frontend.id
  instance_id   = aws_instance.frontend.id
}

resource "aws_instance" "backend" {
  ami                         = var.ami_id
  instance_type               = var.backend_instance_type
  subnet_id                   = var.backend_subnet_id
  vpc_security_group_ids      = [var.backend_security_group_id]
  associate_public_ip_address = true
  iam_instance_profile        = var.backend_instance_profile
  monitoring                  = var.enable_detailed_monitoring

  user_data = templatefile("${path.module}/user_data.sh.tftpl", {
    instance_role      = "backend"
    aws_region         = var.aws_region
    domain_name        = var.domain_name
    backend_secret_arn = var.backend_secret_arn
  })

  user_data_replace_on_change = true

  root_block_device {
    encrypted             = true
    kms_key_id            = "alias/aws/ebs"
    volume_size           = var.root_volume_size_gb
    volume_type           = "gp3"
    delete_on_termination = true
  }

  lifecycle {
    # Existing encrypted root volumes cannot change KMS keys in place. Keep the
    # current volume; replacement instances still use the AWS-managed key above.
    ignore_changes = [root_block_device[0].kms_key_id]
  }

  metadata_options {
    http_endpoint               = "enabled"
    http_protocol_ipv6          = "disabled"
    http_put_response_hop_limit = 1
    http_tokens                 = "required"
    instance_metadata_tags      = "disabled"
  }

  maintenance_options {
    auto_recovery = "default"
  }

  credit_specification {
    cpu_credits = "standard"
  }

  volume_tags = merge(var.tags, {
    Name = "${var.name_prefix}-backend-root"
    Role = "backend"
  })

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-backend"
    Role = "backend"
  })
}
