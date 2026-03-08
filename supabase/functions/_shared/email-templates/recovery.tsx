/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reset your Zyntra password</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>⚡ Zyntra</Text>
        <Heading style={h1}>Reset your password</Heading>
        <Text style={text}>
          We got a request to reset your password. Click below to choose a new one — then get back to training.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Reset Password
        </Button>
        <Text style={footer}>
          Didn't request this? No worries — your password stays the same.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', 'Plus Jakarta Sans', Arial, sans-serif" }
const container = { padding: '32px 28px' }
const brand = { fontSize: '16px', fontWeight: 'bold' as const, color: '#1566C0', margin: '0 0 24px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#111827', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#6d7380', lineHeight: '1.6', margin: '0 0 28px' }
const button = {
  backgroundColor: '#1566C0',
  color: '#ffffff',
  fontSize: '15px',
  borderRadius: '10px',
  padding: '12px 24px',
  textDecoration: 'none',
  fontWeight: 'bold' as const,
}
const footer = { fontSize: '12px', color: '#999999', margin: '32px 0 0' }
