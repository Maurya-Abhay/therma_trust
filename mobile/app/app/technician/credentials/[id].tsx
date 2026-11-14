import React from 'react';
import { Alert, Linking, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ExternalLink, FileBadge } from 'lucide-react-native';
import { fetchCredential, verifyCredential } from '@/src/api/endpoints';
import { API_BASE_URL } from '@/src/api/client';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { Button } from '@/src/components/ui/Button';
import { StatusChip } from '@/src/components/ui/Chip';
import { IconBadge, Pill, Section, State, Surface, toneFor } from '@/src/components/ui/kit';
import { useAuth } from '@/src/auth/AuthContext';
import { useTheme } from '@/src/theme/ThemeProvider';

export default function CredentialDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const credentialId = Number(Array.isArray(id) ? id[0] : id);
  const { user } = useAuth();
  const { t } = useTheme();
  const queryClient = useQueryClient();

  const {
    data: credential,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['credential', credentialId],
    queryFn: () => fetchCredential(credentialId),
    enabled: Number.isInteger(credentialId) && credentialId > 0,
  });

  const verifyMutation = useMutation({
    mutationFn: (status: string) => verifyCredential(credentialId, status),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['credential', credentialId] }),
        queryClient.invalidateQueries({ queryKey: ['my-credentials'] }),
        queryClient.invalidateQueries({ queryKey: ['credentials'] }),
      ]);
      Alert.alert('Updated', 'Credential status has been updated.');
    },
    onError: (error: any) => Alert.alert('Error', error.response?.data?.detail || 'Failed to update credential status.'),
  });

  if (isLoading || isError || !credential) {
    return (
      <ScreenContainer headerTitle="Credential" showProfile={false}>
        <State loading={isLoading} error={isError} empty={!isLoading && !isError ? 'Credential not found.' : undefined} onRetry={() => { void refetch(); }} />
      </ScreenContainer>
    );
  }

  const isExpired = !!credential.expiry_date && new Date(credential.expiry_date).getTime() < Date.now();
  const canVerify = user?.role === 'admin' || (user?.role === 'contractor_manager' && credential.technician === user.id);
  const documentUrl = /^https?:\/\//i.test(credential.file)
    ? credential.file
    : new URL(credential.file, `${API_BASE_URL}/`).toString();

  const openDocument = async () => {
    try {
      const supported = await Linking.canOpenURL(documentUrl);
      if (!supported) {
        Alert.alert('Unavailable', 'This document link cannot be opened on this device.');
        return;
      }
      await Linking.openURL(documentUrl);
    } catch {
      Alert.alert('Error', 'Unable to open the credential document.');
    }
  };

  return (
    <ScreenContainer headerTitle={credential.name} showProfile={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
        <Surface style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconBadge Icon={FileBadge} tone={isExpired ? 'bad' : toneFor(credential.effective_status)} size={48} />
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={{ color: t.text, fontSize: 17, fontWeight: '800' }}>{credential.name}</Text>
              <Text style={{ color: t.sub, fontSize: 12 }}>{credential.issuer_name}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <StatusChip status={credential.effective_status} />
            <Pill text={`Workflow: ${credential.status}`} tone={toneFor(credential.status)} />
            {isExpired ? <Pill text="Expired" tone="bad" /> : null}
          </View>
        </Surface>

        <Section title="Credential details" />
        <Surface style={{ paddingVertical: 4 }}>
          {[
            ['Issuer', credential.issuer_name],
            ['Credential number', credential.credential_number],
            ['Technician', credential.technician_name],
            ['Issue date', credential.issue_date ? format(new Date(credential.issue_date), 'd MMM yyyy') : 'Not provided'],
            ['Expiry date', credential.expiry_date ? format(new Date(credential.expiry_date), 'd MMM yyyy') : 'No expiry date'],
            ['Created', credential.created_at ? format(new Date(credential.created_at), 'd MMM yyyy') : '—'],
            ['Notes', credential.notes || 'No notes'],
          ].map(([label, value], index, rows) => (
            <View key={label} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderBottomWidth: index === rows.length - 1 ? 0 : 1, borderBottomColor: t.line }}>
              <Text style={{ width: '36%', color: t.sub, fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</Text>
              <Text style={{ flex: 1, color: t.text, fontSize: 13, lineHeight: 18, textAlign: 'right' }}>{value}</Text>
            </View>
          ))}
        </Surface>

        {credential.ai_check ? (
          <>
            <Section title="Document check" />
            <Surface style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pill text={`Model: ${credential.ai_check.model}`} tone="info" />
                <Pill text={format(new Date(credential.ai_check.checked_at), 'd MMM yyyy')} tone="primary" />
              </View>
              <Text style={{ color: t.text, fontSize: 13, fontWeight: '800' }}>Extracted fields</Text>
              {Object.entries(credential.ai_check.extracted).map(([key, value]) => value ? (
                <View key={key} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                  <Text style={{ color: t.sub, fontSize: 12, textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</Text>
                  <Text style={{ color: t.text, fontSize: 12, flex: 1, textAlign: 'right' }}>{String(value)}</Text>
                </View>
              ) : null)}
              {credential.ai_check.flags.map((flag, index) => (
                <Pill key={`${flag.code}-${index}`} text={`${flag.code}: ${flag.message}`} tone={flag.severity === 'warning' ? 'warn' : 'info'} />
              ))}
            </Surface>
          </>
        ) : null}

        <Section title="Document" />
        <Button
          variant="outline"
          fullWidth
          disabled={!credential.file}
          onPress={openDocument}
          leftIcon={<ExternalLink size={16} color={t.primary} />}
        >
          View credential document
        </Button>

        {canVerify ? (
          <>
            <Section title="Verification actions" />
            <Surface style={{ gap: 9 }}>
              <Button variant="outline" loading={verifyMutation.isPending} disabled={verifyMutation.isPending} onPress={() => verifyMutation.mutate('document_verified')}>Mark document verified</Button>
              <Button variant="outline" loading={verifyMutation.isPending} disabled={verifyMutation.isPending} onPress={() => verifyMutation.mutate('issuer_confirmed')}>Confirm with issuer</Button>
              <Button variant="primary" loading={verifyMutation.isPending} disabled={verifyMutation.isPending} onPress={() => verifyMutation.mutate('platform_verified')}>Platform verified</Button>
              <Button variant="danger" loading={verifyMutation.isPending} disabled={verifyMutation.isPending} onPress={() => verifyMutation.mutate('rejected')}>Reject credential</Button>
            </Surface>
          </>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}
