import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, ShieldCheck } from 'lucide-react-native';
import { fetchPublicVerification } from '@/src/api/endpoints';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { Button } from '@/src/components/ui/Button';
import { StatusChip } from '@/src/components/ui/Chip';
import { IconBadge, PortalHero, Section, State, Surface } from '@/src/components/ui/kit';
import { useTheme } from '@/src/theme/ThemeProvider';

export default function VerifyScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { t } = useTheme();
  const verificationQuery = useQuery({
    queryKey: ['public-verification', token],
    queryFn: () => fetchPublicVerification(token),
    enabled: Boolean(token),
    staleTime: 60_000,
  });
  const verification = verificationQuery.data;

  if (!token) {
    return <ScreenContainer headerTitle="Verification" showBrand showProfile={false}><State empty="This verification link is incomplete." /></ScreenContainer>;
  }
  if (verificationQuery.isLoading) {
    return <ScreenContainer headerTitle="Verification" showBrand showProfile={false}><State loading /></ScreenContainer>;
  }
  if (verificationQuery.isError || !verification) {
    return (
      <ScreenContainer headerTitle="Verification" showBrand showProfile={false}>
        <Surface style={{ alignItems: 'center', gap: 12, padding: 22 }}>
          <IconBadge Icon={ShieldCheck} tone="bad" size={48} />
          <Text style={{ color: t.text, fontSize: 16, fontWeight: '800', textAlign: 'center' }}>Verification unavailable</Text>
          <Text style={{ color: t.sub, fontSize: 12, textAlign: 'center' }}>This link may be invalid or expired. Check the URL and try again.</Text>
          <Button variant="outline" onPress={() => { void verificationQuery.refetch(); }}>Try again</Button>
        </Surface>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer headerTitle="Technician verification" showBrand showProfile={false} contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 18, paddingBottom: 32 }}>
        <PortalHero
          eyebrow="PUBLIC VERIFICATION"
          title={verification.full_name || 'Verified technician'}
          subtitle={verification.contractor_name ? `${verification.contractor_name} · ${verification.years_experience} years' experience` : `${verification.years_experience} years' experience`}
          Icon={BadgeCheck}
        />
        <View style={{ flexDirection: 'row', gap: 9, marginTop: 12 }}>
          <Surface style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: t.primary, fontSize: 20, fontWeight: '800' }}>{verification.verified_capabilities.length}</Text>
            <Text style={{ color: t.sub, fontSize: 11, marginTop: 3 }}>Verified skills</Text>
          </Surface>
          <Surface style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: t.primary, fontSize: 20, fontWeight: '800' }}>{verification.verified_credentials.length}</Text>
            <Text style={{ color: t.sub, fontSize: 11, marginTop: 3 }}>Verified credentials</Text>
          </Surface>
        </View>

        <Section title="Verified capabilities" />
        {verification.verified_capabilities.length ? (
          <Surface style={{ paddingVertical: 0 }}>
            {verification.verified_capabilities.map((capability, index) => (
              <View key={`${capability.label}-${index}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: index === verification.verified_capabilities.length - 1 ? 0 : 1, borderBottomColor: t.line }}>
                <IconBadge Icon={BadgeCheck} tone="ok" size={38} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text, fontSize: 13, fontWeight: '700' }}>{capability.label}</Text>
                  <Text style={{ color: t.sub, fontSize: 11, marginTop: 3 }}>
                    {capability.capability_type.replace(/_/g, ' ')} · Verified {capability.verified_at ? new Date(capability.verified_at).toLocaleDateString() : 'recently'}
                  </Text>
                </View>
                <StatusChip status="verified" size="xs" />
              </View>
            ))}
          </Surface>
        ) : <Surface><State empty="No verified capabilities are listed." /></Surface>}

        <Section title="Verified credentials" />
        {verification.verified_credentials.length ? (
          <Surface style={{ paddingVertical: 0 }}>
            {verification.verified_credentials.map((credential, index) => (
              <View key={`${credential.name}-${index}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: index === verification.verified_credentials.length - 1 ? 0 : 1, borderBottomColor: t.line }}>
                <IconBadge Icon={ShieldCheck} tone="info" size={38} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text, fontSize: 13, fontWeight: '700' }}>{credential.name}</Text>
                  <Text style={{ color: t.sub, fontSize: 11, marginTop: 3 }}>
                    {credential.issuer_name}{credential.expiry_date ? ` · Expires ${new Date(credential.expiry_date).toLocaleDateString()}` : ''}
                  </Text>
                </View>
                <StatusChip status="verified" size="xs" />
              </View>
            ))}
          </Surface>
        ) : <Surface><State empty="No verified credentials are listed." /></Surface>}

        <Text style={{ color: t.sub, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 22 }}>
          This public page shows only currently verified capabilities and credentials. Powered by ThermaTrust.
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}
