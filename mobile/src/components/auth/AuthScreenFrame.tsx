import React from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldCheck } from 'lucide-react-native';
import { Gradient } from '@/src/components/ui/kit';
import { useTheme } from '@/src/theme/ThemeProvider';

interface Props { title: string; subtitle: string; children: React.ReactNode; eyebrow?: string; heroIcon?: React.ReactNode }

export function AuthBrand({ light = true }: { light?: boolean }) {
  const { t } = useTheme();
  const c = light ? '#FFFFFF' : t.text;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Image source={require('../../../assets/icon.png')} style={{ width: 40, height: 40, borderRadius: 12 }} />
      <Text style={{ color: c, fontSize: 22, fontWeight: '800' }}>Therma<Text style={{ color: '#5EEAD4' }}>Trust</Text></Text>
    </View>
  );
}

export function AuthScreenFrame({ title, subtitle, children, eyebrow = 'SECURE ACCESS', heroIcon }: Props) {
  const { t, isDark } = useTheme();
  const gradientColors = isDark ? ['#071B31', '#064E52'] : ['#0B2F5B', '#0F766E'];
  const body = (
    <ScrollView style={{ flex: 1, width: '100%' }} contentContainerStyle={{ flexGrow: 1, width: '100%', paddingBottom: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Gradient colors={gradientColors} style={{ width: '100%', minHeight: 250, paddingTop: 42, paddingBottom: 54, paddingHorizontal: 24, borderBottomLeftRadius: 36, borderBottomRightRadius: 36 }}>
        <AuthBrand />
        {heroIcon ? <View style={{ marginTop: 14 }}>{heroIcon}</View> : null}
        <Text style={{ color: 'rgba(255,255,255,0.76)', fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginTop: 24 }}>{eyebrow}</Text>
        <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '800', marginTop: 7 }}>{title}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 14, marginTop: 6, lineHeight: 20 }}>{subtitle}</Text>
      </Gradient>
      <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', marginTop: -28, paddingHorizontal: 18 }}>
        <View style={{ backgroundColor: t.card, borderRadius: 24, padding: 18, borderWidth: 1, borderColor: t.line }}>{children}</View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 24 }}>
        <ShieldCheck size={14} color={t.primary} />
        <Text style={{ color: t.sub, fontSize: 12 }}>Secure access · Trusted operations</Text>
      </View>
    </ScrollView>
  );
  return (
    <SafeAreaView style={{ flex: 1, width: '100%', backgroundColor: t.bg }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1, width: '100%' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>{body}</KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function AuthSplash() {
  const { isDark } = useTheme();
  return (
    <Gradient colors={isDark ? ['#071B31', '#064E52'] : ['#0B2F5B', '#0F766E']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', gap: 20 }} edges={['top', 'bottom']}>
        <AuthBrand />
        <ActivityIndicator color="#FFFFFF" />
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>Loading your secure workspace…</Text>
      </SafeAreaView>
    </Gradient>
  );
}
