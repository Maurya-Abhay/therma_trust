import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowRight } from 'lucide-react-native';
import { Button } from '@/src/components/ui/Button';
import { Gradient } from '@/src/components/ui/kit';
import { useTheme } from '@/src/theme/ThemeProvider';

export default function Splash() {
  const router = useRouter();
  const { isDark } = useTheme();
  const colors = isDark ? ['#071B31', '#064E52'] : ['#0B2F5B', '#0F766E'];
  return (
    <Gradient colors={colors} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, width: '100%' }} edges={['top', 'bottom']}>
        <View style={{ flex: 1, width: '100%', paddingHorizontal: 28, justifyContent: 'space-between', paddingTop: 30, paddingBottom: 12 }}>
          <View style={{ alignItems: 'center', marginTop: 28 }}>
            <Image source={require('../../assets/icon.png')} style={{ width: 96, height: 96, borderRadius: 28 }} />
            <Text style={{ color: '#FFFFFF', fontSize: 34, fontWeight: '800', marginTop: 18 }}>Therma<Text style={{ color: '#5EEAD4' }}>Trust</Text></Text>
            <Text style={{ color: 'rgba(255,255,255,0.82)', fontSize: 15, textAlign: 'center', marginTop: 12, lineHeight: 22 }}>Smart HVAC management.{'\n'}Trusted service.</Text>
          </View>
          <View style={{ width: '100%', maxWidth: 480, alignSelf: 'center' }}>
            <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 18 }}>Smarter maintenance.{'\n'}A greener tomorrow.</Text>
            <Button
              fullWidth
              size="lg"
              onPress={() => router.replace('/auth/register')}
              rightIcon={<ArrowRight size={19} color="#0B2F5B" strokeWidth={2.5} />}
              style={styles.primaryAction}
              textStyle={styles.primaryActionText}
            >
              Get started
            </Button>
            <Pressable accessibilityRole="button" onPress={() => router.replace('/auth/login')} style={{ paddingVertical: 16 }}>
              <Text style={{ color: 'rgba(255,255,255,0.85)', textAlign: 'center', fontSize: 14 }}>Already have an account? <Text style={{ fontWeight: '800', color: '#FFFFFF' }}>Sign in</Text></Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Gradient>
  );
}

const styles = StyleSheet.create({
  primaryAction: {
    width: '100%',
    minHeight: 58,
    alignSelf: 'stretch',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
    elevation: 4,
    shadowColor: '#031525',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
  },
  primaryActionText: { color: '#0B2F5B', fontSize: 16, fontWeight: '800' },
});
