import React, { useState } from 'react';
import { Alert, Modal, ScrollView, Share, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, Download, ShieldCheck, UserRound } from 'lucide-react-native';
import { format } from 'date-fns';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import QRCode from 'react-native-qrcode-svg';
import { fetchMyTechnicianProfile, fetchPublicVerification, publicPassportPdfUrl, publicVerifyUrl } from '@/src/api/endpoints';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { Button } from '@/src/components/ui/Button';
import { RoleChip, StatusChip } from '@/src/components/ui/Chip';
import { IconBadge, PortalHero, Section, State, Stat, Surface } from '@/src/components/ui/kit';
import { useAuth } from '@/src/auth/AuthContext';
import { useTheme } from '@/src/theme/ThemeProvider';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Could not read the generated passport PDF.'));
        return;
      }
      resolve(reader.result.split(',')[1]);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the generated passport PDF.'));
    reader.readAsDataURL(blob);
  });
}

export default function PassportScreen() {
  const { user, isLoading: authLoading } = useAuth();
  const { t } = useTheme();
  const [showQR, setShowQR] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const profile = useQuery({
    queryKey: ['my-technician-profile'],
    queryFn: fetchMyTechnicianProfile,
    enabled: !!user,
  });
  const token = profile.data?.public_token;
  const verification = useQuery({
    queryKey: ['public-verification', token],
    queryFn: () => fetchPublicVerification(token!),
    enabled: !!token,
  });

  const downloadPassport = async () => {
    if (!token) {
      Alert.alert('Unavailable', 'A public verification profile is not available yet.');
      return;
    }
    setDownloading(true);
    try {
      const response = await fetch(publicPassportPdfUrl(token));
      if (!response.ok) throw new Error(`Passport download failed with status ${response.status}.`);
      const fileUri = `${FileSystem.cacheDirectory}passport-${token}.pdf`;
      await FileSystem.writeAsStringAsync(fileUri, await blobToBase64(await response.blob()), { encoding: FileSystem.EncodingType.Base64 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf', dialogTitle: 'Save Passport PDF' });
      } else {
        Alert.alert('Downloaded', 'The passport PDF was saved to the app cache, but sharing is not available on this device.');
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to download the passport.');
    } finally {
      setDownloading(false);
    }
  };

  const shareVerificationLink = async () => {
    if (!token) {
      Alert.alert('Unavailable', 'A public verification profile is not available yet.');
      return;
    }
    const url = publicVerifyUrl(token);
    try {
      await Share.share({
        title: 'Technician verification',
        message: `Verify ${profile.data?.full_name ?? 'this technician'} on ThermaTrust: ${url}`,
        url,
      });
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not share the verification link.');
    }
  };

  if (authLoading || profile.isLoading) {
    return <ScreenContainer headerTitle="Passport" showProfile={false}><State loading /></ScreenContainer>;
  }
  if (profile.isError) {
    return <ScreenContainer headerTitle="Passport" showProfile={false}><State error onRetry={() => { void profile.refetch(); }} /></ScreenContainer>;
  }
  if (!profile.data) {
    return <ScreenContainer headerTitle="Passport" showProfile={false}><State empty="No technician profile was found." /></ScreenContainer>;
  }

  const technician = profile.data;
  const verifiedCapabilities = verification.data?.verified_capabilities ?? [];
  const verifiedCredentials = verification.data?.verified_credentials ?? [];
  const initials = technician.full_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

  return (
    <ScreenContainer headerTitle="Technician passport" showProfile={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
        <PortalHero eyebrow="VERIFIED PROFESSIONAL" title={technician.full_name} subtitle={technician.contractor_name || 'Independent technician'} Icon={ShieldCheck} />

        <Surface style={{ marginTop: 14, padding: 14, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: t.tint }}>
              <Text style={{ color: t.primary, fontSize: 18, fontWeight: '900' }}>{initials || 'TT'}</Text>
            </View>
            <View style={{ flex: 1, gap: 5 }}>
              <Text numberOfLines={1} style={{ color: t.text, fontSize: 16, fontWeight: '800' }}>{technician.full_name}</Text>
              <Text numberOfLines={1} style={{ color: t.sub, fontSize: 11 }}>{technician.contractor_name || 'Independent technician'}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {user?.role ? <RoleChip role={user.role} size="xs" /> : null}
                <StatusChip status={technician.available ? 'active' : 'unavailable'} size="xs" />
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Stat Icon={BadgeCheck} value={verifiedCapabilities.length} label="Skills" tone="ok" />
            <Stat Icon={ShieldCheck} value={verifiedCredentials.length} label="Credentials" tone="info" />
            <Stat Icon={UserRound} value={technician.average_rating ? technician.average_rating.toFixed(1) : '—'} label="Rating" tone="warn" />
          </View>
          <Text style={{ color: t.sub, fontSize: 11 }}>{technician.years_experience} years of experience · Platform profile</Text>
        </Surface>

        <Section title="Verified capabilities" action={`${verifiedCapabilities.length} verified`} />
        <Surface style={{ gap: 10 }}>
          {verification.isLoading ? <State loading /> : verification.isError ? <State error onRetry={() => { void verification.refetch(); }} /> : verifiedCapabilities.length ? verifiedCapabilities.map((capability, index) => (
            <View key={`${capability.label}-${index}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <IconBadge Icon={BadgeCheck} tone="ok" size={36} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontSize: 13, fontWeight: '700' }}>{capability.label}</Text>
                <Text style={{ color: t.sub, fontSize: 11, marginTop: 2 }}>{capability.capability_type} · {capability.verified_at ? format(new Date(capability.verified_at), 'd MMM yyyy') : 'Verified'}</Text>
              </View>
            </View>
          )) : <State empty="No verified capabilities yet." />}
        </Surface>

        <Section title="Verified credentials" action={`${verifiedCredentials.length} verified`} />
        <Surface style={{ gap: 10 }}>
          {verification.isLoading ? <State loading /> : verification.isError ? <State error onRetry={() => { void verification.refetch(); }} /> : verifiedCredentials.length ? verifiedCredentials.map((credential, index) => (
            <View key={`${credential.name}-${index}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <IconBadge Icon={ShieldCheck} tone="ok" size={36} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontSize: 13, fontWeight: '700' }}>{credential.name}</Text>
                <Text style={{ color: t.sub, fontSize: 11, marginTop: 2 }}>{credential.issuer_name}{credential.expiry_date ? ` · Expires ${format(new Date(credential.expiry_date), 'd MMM yyyy')}` : ''}</Text>
              </View>
            </View>
          )) : <State empty="No verified credentials yet." />}
        </Surface>

        <Section title="Public verification" />
        <Surface style={{ alignItems: 'center', gap: 8, paddingVertical: 14 }}>
          {token ? (
            <>
              <View style={{ padding: 8, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: t.line }}>
                <QRCode value={publicVerifyUrl(token)} size={148} color="#0B1F3A" backgroundColor="#FFFFFF" />
              </View>
              <Text style={{ color: t.sub, fontSize: 11, textAlign: 'center' }}>Scan to verify this passport.</Text>
              <Text selectable numberOfLines={2} style={{ color: t.primary, fontSize: 10, textAlign: 'center' }}>{publicVerifyUrl(token)}</Text>
            </>
          ) : <State empty="A verification QR code is not available." />}
        </Surface>

        <View style={{ gap: 9, marginTop: 14 }}>
          <View style={{ flexDirection: 'row', gap: 9 }}>
            <Button style={{ flex: 1 }} loading={downloading} disabled={!token} leftIcon={<Download size={16} color="#FFFFFF" />} onPress={downloadPassport}>Download PDF</Button>
            <Button style={{ flex: 1 }} variant="outline" disabled={!token} onPress={shareVerificationLink}>Share link</Button>
          </View>
          <Button fullWidth variant="ghost" disabled={!token} onPress={() => setShowQR(true)}>View QR full screen</Button>
        </View>
      </ScrollView>

      <Modal visible={showQR && !!token} transparent animationType="fade" onRequestClose={() => setShowQR(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', padding: 22 }}>
          <Surface style={{ alignItems: 'center', gap: 12, padding: 20 }}>
            <Text style={{ color: t.text, fontSize: 17, fontWeight: '800' }}>Verification QR code</Text>
            {token ? <QRCode value={publicVerifyUrl(token)} size={250} color="#0B1F3A" backgroundColor="#FFFFFF" /> : null}
            <Text style={{ color: t.sub, fontSize: 12, textAlign: 'center' }}>Scan to verify {technician.full_name}</Text>
            {token ? <Text selectable style={{ color: t.primary, fontSize: 10, textAlign: 'center' }}>{publicVerifyUrl(token)}</Text> : null}
            <Button fullWidth variant="outline" onPress={() => setShowQR(false)}>Close</Button>
          </Surface>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
