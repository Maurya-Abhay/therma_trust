import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Camera, FileBadge, FileUp, LoaderCircle, Trash2 } from 'lucide-react-native';
import { format, isValid, parseISO } from 'date-fns';
import { createCredential, extractCredential } from '@/src/api/endpoints';
import { ExtractedCredentialFields } from '@/src/types/api';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { IconBadge, Pill, Section, Surface } from '@/src/components/ui/kit';
import { useTheme } from '@/src/theme/ThemeProvider';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import DateTimePicker from '@react-native-community/datetimepicker';

type CredentialForm = {
  name: string;
  issuer_name: string;
  credential_number: string;
  issue_date: string;
  expiry_date: string;
  notes: string;
};
type UploadFile = { uri: string; name: string; type: string };
type FormField = keyof CredentialForm;
const MAX_FILE_BYTES = 1024 * 1024;

const INITIAL_FORM: CredentialForm = {
  name: '',
  issuer_name: '',
  credential_number: '',
  issue_date: '',
  expiry_date: '',
  notes: '',
};

export default function CreateCredentialScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTheme();
  const [form, setForm] = useState<CredentialForm>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<FormField, string>>>({});
  const [selectedFile, setSelectedFile] = useState<UploadFile | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedCredentialFields | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [dateField, setDateField] = useState<'issue_date' | 'expiry_date' | null>(null);

  const createMutation = useMutation({
    mutationFn: () => {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => payload.append(key, value));
      if (selectedFile) payload.append('file', selectedFile as any);
      return createCredential(payload);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['my-credentials'] }),
        queryClient.invalidateQueries({ queryKey: ['credentials'] }),
        queryClient.invalidateQueries({ queryKey: ['my-technician'] }),
      ]);
      Alert.alert('Credential submitted', 'Your credential has been added for review.', [{ text: 'OK', onPress: () => router.back() }]);
    },
    onError: (error: any) => Alert.alert('Error', error.response?.data?.detail || 'Could not create credential.'),
  });

  const extractFromFile = async (file: UploadFile) => {
    setExtracting(true);
    setExtractionError(null);
    setExtractedData(null);
    try {
      const data = await extractCredential(file);
      setExtractedData(data);
      if (data.is_credential_document) {
        setForm((current) => ({
          ...current,
          name: data.credential_name || data.holder_name || current.name,
          issuer_name: data.issuer_name || current.issuer_name,
          credential_number: data.credential_number || current.credential_number,
          issue_date: data.issue_date?.slice(0, 10) || current.issue_date,
          expiry_date: data.expiry_date?.slice(0, 10) || current.expiry_date,
          notes: data.notes || current.notes,
        }));
      }
    } catch (error) {
      setExtractionError(error instanceof Error ? error.message : 'Automatic document extraction failed. You can still enter the details manually.');
    } finally {
      setExtracting(false);
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      if (asset.size && asset.size > MAX_FILE_BYTES) {
        Alert.alert('File too large', 'Choose a document smaller than 1 MB.');
        return;
      }
      const file: UploadFile = { uri: asset.uri, name: asset.name, type: asset.mimeType || 'application/octet-stream' };
      setSelectedFile(file);
      await extractFromFile(file);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not select the document.');
    }
  };

  const pickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8 });
      if (result.canceled || !result.assets[0]) return;
      const compressed = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1600 } }],
        { compress: 0.65, format: ImageManipulator.SaveFormat.JPEG },
      );
      const size = (await fetch(compressed.uri)).headers.get('content-length');
      if (size && Number(size) > MAX_FILE_BYTES) {
        Alert.alert('Image too large', 'Choose a clearer photo with less background, or crop the document before uploading.');
        return;
      }
      const file: UploadFile = { uri: compressed.uri, name: 'credential.jpg', type: 'image/jpeg' };
      setSelectedFile(file);
      await extractFromFile(file);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not select the image.');
    }
  };

  const updateField = (field: FormField, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = () => {
    const nextErrors: Partial<Record<FormField, string>> = {};
    if (!form.name.trim()) nextErrors.name = 'Enter a credential name.';
    if (!form.issuer_name.trim()) nextErrors.issuer_name = 'Enter the issuing organization.';
    if (!form.credential_number.trim()) nextErrors.credential_number = 'Enter the credential number.';
    if (!selectedFile) {
      Alert.alert('Document required', 'Attach a credential document before submitting.');
      return;
    }
    for (const [label, value] of [['Issue date', form.issue_date], ['Expiry date', form.expiry_date]] as const) {
      const date = value ? parseISO(value) : null;
      if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !date || !isValid(date) || format(date, 'yyyy-MM-dd') !== value)) {
        const key: FormField = label === 'Issue date' ? 'issue_date' : 'expiry_date';
        nextErrors[key] = 'Use the YYYY-MM-DD format.';
      }
    }
    if (form.issue_date && form.expiry_date && form.expiry_date < form.issue_date) {
      nextErrors.expiry_date = 'Expiry date cannot be before issue date.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    createMutation.mutate();
  };

  return (
    <ScreenContainer headerTitle="Add credential" showProfile={false} contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: 28 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <IconBadge Icon={FileBadge} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontSize: 19, fontWeight: '800' }}>Submit a credential</Text>
              <Text style={{ color: t.sub, fontSize: 12, lineHeight: 17, marginTop: 3 }}>Attach your certificate and confirm the extracted details before sending it for review.</Text>
            </View>
          </View>

          <Section title="Credential document" />
          <Surface style={{ gap: 11 }}>
            {selectedFile ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <IconBadge Icon={FileBadge} tone="ok" size={40} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: t.text, fontSize: 13, fontWeight: '700' }}>{selectedFile.name}</Text>
                  <Text style={{ color: t.sub, fontSize: 11, marginTop: 3 }}>{selectedFile.type}</Text>
                </View>
                <Pressable accessibilityRole="button" onPress={() => { setSelectedFile(null); setExtractedData(null); setExtractionError(null); }}>
                  <Trash2 size={18} color={t.bad} />
                </Pressable>
              </View>
            ) : (
              <Text style={{ color: t.sub, fontSize: 12, lineHeight: 18 }}>Add a PDF or clear photo of the certificate. The document is required for review.</Text>
            )}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button style={{ flex: 1 }} variant="outline" leftIcon={<FileUp size={15} color={t.primary} />} onPress={pickDocument}>Choose document</Button>
              <Button style={{ flex: 1 }} variant="outline" leftIcon={<Camera size={15} color={t.primary} />} onPress={pickPhoto}>Choose photo</Button>
            </View>
            {extracting ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><LoaderCircle size={15} color={t.primary} /><Text style={{ color: t.primary, fontSize: 12 }}>Reading document details…</Text></View> : null}
            {extractedData?.is_credential_document ? (
              <View style={{ gap: 7 }}>
                <Pill text="Document recognized - review the fields below" tone="ok" />
                {extractedData.flags?.map((flag, index) => <Pill key={`${flag.code}-${index}`} text={flag.message} tone={flag.severity === 'warning' ? 'warn' : 'info'} />)}
              </View>
            ) : extractedData ? <Pill text="This file may not be a credential. Confirm the document before submitting." tone="warn" /> : null}
            {extractionError ? <Text style={{ color: t.bad, fontSize: 12 }}>{extractionError}</Text> : null}
          </Surface>

          <Section title="Credential details" />
          <Surface style={{ gap: 12 }}>
            <Input label="Credential name *" placeholder="e.g. EPA 608 Universal" value={form.name} onChangeText={(value) => updateField('name', value)} error={errors.name} />
            <Input label="Issuer *" placeholder="e.g. ESCO Institute" value={form.issuer_name} onChangeText={(value) => updateField('issuer_name', value)} error={errors.issuer_name} />
            <Input label="Credential number *" placeholder="Enter the number shown on the certificate" value={form.credential_number} onChangeText={(value) => updateField('credential_number', value)} error={errors.credential_number} />
            {(['issue_date', 'expiry_date'] as const).map((field) => (
              <View key={field}>
                <Text style={{ color: t.sub, fontSize: 12, fontWeight: '700', marginBottom: 8 }}>{field === 'issue_date' ? 'Issue date' : 'Expiry date'}</Text>
                <Pressable onPress={() => setDateField(field)} style={{ borderWidth: 1, borderColor: errors[field] ? t.bad : t.line, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 13, backgroundColor: t.card }}>
                  <Text style={{ color: form[field] ? t.text : t.sub, fontSize: 14 }}>{form[field] || 'Select date'}</Text>
                </Pressable>
                {errors[field] ? <Text style={{ color: t.bad, fontSize: 11, marginTop: 5 }}>{errors[field]}</Text> : null}
                {dateField === field ? (
                  <DateTimePicker
                    value={form[field] ? parseISO(form[field]) : new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(_, selected) => {
                      if (Platform.OS !== 'ios') setDateField(null);
                      if (selected) updateField(field, format(selected, 'yyyy-MM-dd'));
                    }}
                  />
                ) : null}
              </View>
            ))}
            <Input label="Notes" placeholder="Additional information (optional)" multiline numberOfLines={3} value={form.notes} onChangeText={(value) => updateField('notes', value)} />
            <Button fullWidth loading={createMutation.isPending} disabled={extracting} onPress={submit}>Submit for review</Button>
          </Surface>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
