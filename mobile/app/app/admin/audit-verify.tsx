import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Fingerprint, ShieldCheck } from 'lucide-react-native';
import { AuditVerifyResult, verifyAuditLog } from '@/src/api/endpoints';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { Button } from '@/src/components/ui/Button';
import { IconBadge, Pill, PortalHero, Section, Surface } from '@/src/components/ui/kit';
import { useTheme } from '@/src/theme/ThemeProvider';

export default function AuditVerifyScreen() {
  const { t } = useTheme();
  const [result, setResult] = useState<AuditVerifyResult | null>(null);

  const verifyMutation = useMutation({
    mutationFn: verifyAuditLog,
    onSuccess: setResult,
    onError: (err: any) => {
      Alert.alert('Verification failed', err.response?.data?.detail || 'Could not verify the audit chain. Please try again.');
    },
  });

  const valid = result?.valid ?? false;
  const resultTone = valid ? 'ok' : 'bad';
  const resultColor = valid ? t.ok : t.bad;
  const resultBackground = valid ? t.okBg : t.badBg;
  const ResultIcon = valid ? CheckCircle2 : AlertTriangle;

  return (
    <ScreenContainer
      headerTitle="Audit Integrity"
      showBack
      showProfile={false}
      contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}
    >
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <PortalHero
          eyebrow="SECURITY CENTER"
          title="Integrity check"
          subtitle="Check that the platform activity history remains intact."
          Icon={ShieldCheck}
        />

        <Section title="About this check" />
        <Surface style={{ gap: 12 }}>
          <Text style={{ color: t.sub, fontSize: 13, lineHeight: 20 }}>
            Audit entries are cryptographically linked. Verification checks the chain and reports how many entries were validated and whether a broken link was found.
          </Text>
          <View style={{ gap: 10 }}>
            {[
              'Checks the audit chain from its beginning.',
              'Reports the number of entries checked.',
              'Highlights an integrity issue when one is found.',
            ].map((point) => (
              <View key={point} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: t.primary }} />
                <Text style={{ flex: 1, color: t.text, fontSize: 12, lineHeight: 18 }}>{point}</Text>
              </View>
            ))}
          </View>
        </Surface>

        <Section title="Verification" />
        <Surface style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
            <IconBadge Icon={Fingerprint} size={44} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: t.text, fontSize: 14, fontWeight: '800' }}>Audit chain status</Text>
              <Text style={{ color: t.sub, fontSize: 12 }}>
                {verifyMutation.isPending ? 'Checking the latest audit entries…' : 'Run a check to confirm the chain integrity.'}
              </Text>
            </View>
          </View>
          <Button
            variant="primary"
            fullWidth
            loading={verifyMutation.isPending}
            onPress={() => verifyMutation.mutate()}
            leftIcon={<ShieldCheck size={18} color="#FFFFFF" />}
          >
            {verifyMutation.isPending ? 'Verifying audit chain' : 'Verify audit chain'}
          </Button>
        </Surface>

        <Section title="Latest result" />
        {result ? (
          <Surface style={{ padding: 0, overflow: 'hidden' }}>
            <View style={{ backgroundColor: resultBackground, padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' }}>
                  <ResultIcon size={25} color={resultColor} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <Text style={{ color: t.text, fontSize: 16, fontWeight: '800' }}>
                    {result.valid ? 'Chain valid' : 'Chain integrity issue'}
                  </Text>
                  <Text style={{ color: t.sub, fontSize: 12 }}>
                    {result.valid
                      ? 'All checked entries passed verification.'
                      : result.broken_at_id !== null
                        ? `Broken link reported at entry #${result.broken_at_id}.`
                        : 'A broken link was reported in the audit chain.'}
                  </Text>
                </View>
                <Pill text={result.valid ? 'Valid' : 'Issue found'} tone={resultTone} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, padding: 14 }}>
              <View style={{ flex: 1, padding: 13, borderRadius: 14, backgroundColor: t.field }}>
                <Text style={{ color: t.sub, fontSize: 10, fontWeight: '700' }}>ENTRIES CHECKED</Text>
                <Text style={{ color: t.text, fontSize: 22, fontWeight: '800', marginTop: 5 }}>{result.checked_count}</Text>
              </View>
              <View style={{ flex: 1, padding: 13, borderRadius: 14, backgroundColor: t.field }}>
                <Text style={{ color: t.sub, fontSize: 10, fontWeight: '700' }}>BROKEN AT</Text>
                <Text style={{ color: result.broken_at_id === null ? t.text : t.bad, fontSize: 22, fontWeight: '800', marginTop: 5 }}>
                  {result.broken_at_id === null ? '—' : `#${result.broken_at_id}`}
                </Text>
              </View>
            </View>
          </Surface>
        ) : (
          <Surface style={{ alignItems: 'center', paddingVertical: 22 }}>
            <IconBadge Icon={ShieldCheck} size={48} />
            <Text style={{ color: t.text, fontSize: 14, fontWeight: '700', marginTop: 10 }}>No verification run yet</Text>
            <Text style={{ color: t.sub, fontSize: 12, textAlign: 'center', marginTop: 4 }}>
              Run the check above to see the latest integrity result.
            </Text>
          </Surface>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
