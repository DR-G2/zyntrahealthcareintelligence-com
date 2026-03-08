/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to Zyntra — confirm your email to start training</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>⚡ Zyntra</Text>
        <Heading style={h1}>Welcome aboard.</Heading>
        <Text style={text}>
          You're one step away from training smarter for your AMC exam. Confirm your email (
          <Link href={`mailto:${recipient}`} style={link}>{recipient}</Link>
          ) to get started.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Start Training
        </Button>
        <Text style={footer}>
          If you didn't sign up for Zyntra, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', 'Plus Jakarta Sans', Arial, sans-serif" }
const container = { padding: '32px 28px' }
const brand = { fontSize: '16px', fontWeight: 'bold' as const, color: '#1566C0', margin: '0 0 24px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#111827', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#6d7380', lineHeight: '1.6', margin: '0 0 28px' }
const link = { color: '#1566C0', textDecoration: 'underline' }
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
