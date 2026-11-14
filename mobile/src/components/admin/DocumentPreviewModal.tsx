import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, Pressable, Text, View } from 'react-native';
import { X, ExternalLink, FileText } from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import { API_BASE_URL } from '@/src/api/config';
import { useTheme } from '@/src/theme/ThemeProvider';
import { Button } from '@/src/components/ui/Button';

function resolveDocumentUrl(file: string) {
  return /^https?:\/\//i.test(file) ? file : new URL(file, `${API_BASE_URL}/`).toString();
}

function isImageUrl(url: string) {
  return /\.(jpe?g|png|gif|webp)(?:\?.*)?$/i.test(url);
}

interface DocumentPreviewModalProps {
  visible: boolean;
  title: string;
  file: string | null | undefined;
  onClose: () => void;
}

export function DocumentPreviewModal({ visible, title, file, onClose }: DocumentPreviewModalProps) {
  const { t } = useTheme();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const url = file ? resolveDocumentUrl(file) : null;

  useEffect(() => {
    setLoading(true);
    setFailed(false);
  }, [url]);

  const openExternally = async () => {
    if (!url) return;
    try {
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Unavailable', 'This document cannot be opened on this device.');
      }
    } catch {
      Alert.alert('Error', 'Unable to open this document.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: t.line }}>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ color: t.text, fontSize: 16, fontWeight: '800' }}>{title}</Text>
            <Text style={{ color: t.sub, fontSize: 11, marginTop: 3 }}>Document preview</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close preview" hitSlop={10} onPress={onClose}>
            <X size={22} color={t.text} />
          </Pressable>
        </View>

        {url ? (
          <View style={{ flex: 1, margin: 12, borderRadius: 14, overflow: 'hidden', backgroundColor: t.card }}>
            {loading && !failed ? <ActivityIndicator color={t.primary} style={{ position: 'absolute', top: 20, left: 0, right: 0, zIndex: 1 }} /> : null}
            {failed ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                <FileText size={42} color={t.sub} />
                <Text style={{ color: t.text, fontSize: 14, fontWeight: '700', marginTop: 12, textAlign: 'center' }}>Preview unavailable</Text>
                <Text style={{ color: t.sub, fontSize: 12, marginTop: 6, textAlign: 'center' }}>Open the original document to review it.</Text>
              </View>
            ) : isImageUrl(url) ? (
              <Image resizeMode="contain" source={{ uri: url }} style={{ flex: 1, width: '100%' }} onLoadEnd={() => setLoading(false)} onError={() => { setLoading(false); setFailed(true); }} />
            ) : (
              <WebView source={{ uri: url }} style={{ flex: 1 }} onLoadEnd={() => setLoading(false)} onError={() => { setLoading(false); setFailed(true); }} />
            )}
          </View>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: t.sub }}>No document was uploaded.</Text>
          </View>
        )}

        <View style={{ padding: 18, paddingTop: 4 }}>
          <Button fullWidth variant="outline" onPress={openExternally} disabled={!url} leftIcon={<ExternalLink size={16} color={t.primary} />}>
            Open original document
          </Button>
        </View>
      </View>
    </Modal>
  );
}
