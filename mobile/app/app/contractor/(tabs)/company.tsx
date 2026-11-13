import React from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, CalendarDays, CheckCircle2, Cylinder, FileCheck2, FileText, ShieldCheck, Tags, Upload, Users, X } from 'lucide-react-native';
import {
  createContractor,
  fetchContractorCompliance,
  fetchContractorDocuments,
  fetchContractors,
  uploadContractorDocument,
} from '@/src/api/endpoints';
import { getApiErrorMessage } from '@/src/api/errorMessage';
import { ContractorDocument } from '@/src/types/api';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { Button } from '@/src/components/ui/Button';
import { Chip, StatusChip } from '@/src/components/ui/Chip';
import { Input } from '@/src/components/ui/Input';
import { CircularActionTile, Grid, IconBadge, Pill, PortalHero, Section, State, Stat, Surface, toneFor } from '@/src/components/ui/kit';
import { useTheme } from '@/src/theme/ThemeProvider';

const DOCUMENT_TYPES = [
  { value: 'business_registration', label: 'Business registration' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'safety_policy', label: 'Safety policy' },
  { value: 'other', label: 'Other' },
];

type PickedFile = { uri: string; name: string; mimeType?: string | null; size?: number };
const CONTRACTOR_ROUTES = {
  roster: '/app/contractor/roster',
  capabilities: '/app/contractor/capabilities',
  cylinders: '/app/contractor/cylinders',
  calendar: '/app/contractor/calendar',
  compliance: '/app/contractor/compliance',
} satisfies Record<string, Href>;

export default function ContractorCompanyHome() {
  const router = useRouter();
  const params = useLocalSearchParams<{ add?: string }>();
  const queryClient = useQueryClient();
  const { t } = useTheme();
  const [form, setForm] = React.useState({ name: '', registration_number: '', service_area: '', response_time_commitment: '' });
  const [showUpload, setShowUpload] = React.useState(false);
  const [docType, setDocType] = React.useState(DOCUMENT_TYPES[0].value);
  const [pickedFile, setPickedFile] = React.useState<PickedFile | null>(null);

  const companyQuery = useQuery({
    queryKey: ['my-contractor-company'],
    queryFn: fetchContractors,
    staleTime: 60_000,
  });
  const company = companyQuery.data?.[0];
  const companyId = company?.id;

  const documentsQuery = useQuery({
    queryKey: ['contractor-documents', companyId],
    queryFn: () => fetchContractorDocuments(companyId!),
    enabled: Boolean(companyId),
    staleTime: 30_000,
  });
  const complianceQuery = useQuery({
    queryKey: ['contractor-compliance', companyId],
    queryFn: () => fetchContractorCompliance(companyId!),
    enabled: Boolean(companyId),
    staleTime: 30_000,
  });

  React.useEffect(() => {
    if (companyId && params.add === '1') setShowUpload(true);
  }, [companyId, params.add]);

  const createMutation = useMutation({
    mutationFn: () => createContractor({
      name: form.name.trim(),
      registration_number: form.registration_number.trim(),
      service_area: form.service_area.trim(),
      response_time_commitment: form.response_time_commitment.trim(),
    }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['my-contractor-company'] }),
        queryClient.invalidateQueries({ queryKey: ['contractors'] }),
      ]);
      Alert.alert('Company registered', 'Your contractor company is ready to manage.');
    },
  });

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!companyId || !pickedFile) throw new Error('Choose a document before uploading.');
      return uploadContractorDocument(companyId, docType, {
        uri: pickedFile.uri,
        name: pickedFile.name,
        type: pickedFile.mimeType || 'application/octet-stream',
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['contractor-documents', companyId] }),
        queryClient.invalidateQueries({ queryKey: ['contractor-compliance', companyId] }),
      ]);
      setShowUpload(false);
      setPickedFile(null);
      Alert.alert('Document uploaded', 'Your document has been submitted for review.');
    },
  });

  const openDocumentPicker = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled) {
        const asset = result.assets[0];
        if (asset.size && asset.size > 5 * 1024 * 1024) {
          setPickedFile(null);
          Alert.alert('File too large', 'Choose a PDF or image smaller than 5 MB.');
          return;
        }
        setPickedFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType, size: asset.size });
      }
    } catch (error) {
      Alert.alert('Could not open files', getApiErrorMessage(error, 'Please try selecting the document again.'));
    }
  };

  const go = (route: keyof typeof CONTRACTOR_ROUTES) => () => router.push(CONTRACTOR_ROUTES[route]);
  const docs = documentsQuery.data ?? [];
  const compliance = complianceQuery.data;

  return (
    <ScreenContainer headerTitle={company?.name ?? 'Company'} headerSubtitle="Contractor workspace" contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <PortalHero
          eyebrow="CONTRACTOR PORTAL"
          title="Company overview"
          subtitle="Manage your registration, team, qualifications, inventory and compliance."
          Icon={Building2}
        />

        {companyQuery.isLoading ? <State loading /> : companyQuery.isError ? (
          <State error onRetry={() => { void companyQuery.refetch(); }} />
        ) : !company ? (
          <Surface style={{ marginTop: 14, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <IconBadge Icon={Building2} size={46} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontSize: 17, fontWeight: '800' }}>Register your company</Text>
                <Text style={{ color: t.sub, fontSize: 12, lineHeight: 18, marginTop: 3 }}>Create a company profile to manage your technicians and compliance documents.</Text>
              </View>
            </View>
            <Input label="Company name *" value={form.name} onChangeText={(name) => setForm((current) => ({ ...current, name }))} placeholder="Company name" />
            <Input label="Service area *" value={form.service_area} onChangeText={(service_area) => setForm((current) => ({ ...current, service_area }))} placeholder="Cities or regions covered" />
            <Input label="Registration number" value={form.registration_number} onChangeText={(registration_number) => setForm((current) => ({ ...current, registration_number }))} placeholder="Optional" />
            <Input label="Response-time commitment" value={form.response_time_commitment} onChangeText={(response_time_commitment) => setForm((current) => ({ ...current, response_time_commitment }))} placeholder="e.g. Within 24 hours" />
            {createMutation.isError ? <Text style={{ color: t.bad, fontSize: 12 }}>{getApiErrorMessage(createMutation.error, 'Company registration failed. Please try again.')}</Text> : null}
            <Button
              loading={createMutation.isPending}
              disabled={!form.name.trim() || !form.service_area.trim()}
              onPress={() => createMutation.mutate()}
            >
              Register company
            </Button>
          </Surface>
        ) : (
          <>
            <Surface style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <IconBadge Icon={Building2} size={46} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ color: t.text, fontSize: 16, fontWeight: '800' }}>{company.name}</Text>
                <Text numberOfLines={1} style={{ color: t.sub, fontSize: 12, marginTop: 3 }}>Registration · {company.registration_number || 'Not provided'}</Text>
                <Text numberOfLines={1} style={{ color: t.sub, fontSize: 12, marginTop: 2 }}>Service area · {company.service_area || 'Not provided'}</Text>
              </View>
              <Pill text={company.verification_status} tone={toneFor(company.verification_status)} />
            </Surface>

            {complianceQuery.isError ? (
              <State error onRetry={() => { void complianceQuery.refetch(); }} />
            ) : complianceQuery.isLoading ? <State loading /> : compliance ? (
              <>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <Stat Icon={Users} value={company.technician_count} label="Technicians" />
                  <Stat Icon={ShieldCheck} value={`${compliance.score}%`} label="Compliance" tone="info" />
                </View>
                <Surface style={{ marginTop: 12, gap: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <Text style={{ color: t.text, fontSize: 14, fontWeight: '800' }}>Compliance overview</Text>
                    <Button size="sm" variant="outline" onPress={go('compliance')}>Details</Button>
                  </View>
                  <ComplianceMetric label="Company verification" value={compliance.company_verified ? 'Verified' : 'Pending'} percent={compliance.company_verified ? 100 : 0} />
                  <ComplianceMetric label="Team capabilities" value={`${compliance.capability_verified_rate}%`} percent={compliance.capability_verified_rate} />
                  <ComplianceMetric label="Credentials" value={`${compliance.credential_verified_rate}%`} percent={compliance.credential_verified_rate} />
                  <ComplianceMetric label="Company documents" value={`${compliance.document_verified_rate}%`} percent={compliance.document_verified_rate} />
                </Surface>
              </>
            ) : null}

            <Section title="Company documents" action="Upload" onAction={() => setShowUpload(true)} />
            <Surface>
              {documentsQuery.isLoading ? <State loading /> : documentsQuery.isError ? (
                <State error onRetry={() => { void documentsQuery.refetch(); }} />
              ) : docs.length ? docs.map((doc, index) => (
                <DocumentRow key={doc.id} document={doc} last={index === docs.length - 1} />
              )) : (
                <View style={{ alignItems: 'center', paddingVertical: 18, gap: 8 }}>
                  <IconBadge Icon={FileText} tone="info" size={42} />
                  <Text style={{ color: t.sub, fontSize: 12, textAlign: 'center' }}>No company documents have been uploaded yet.</Text>
                  <Button size="sm" variant="outline" onPress={() => setShowUpload(true)}>Upload first document</Button>
                </View>
              )}
            </Surface>

            <Section title="Manage" />
            <Grid>
              <CircularActionTile Icon={Users} label="Team roster" onPress={go('roster')} />
              <CircularActionTile Icon={Tags} label="Team capabilities" onPress={go('capabilities')} />
              <CircularActionTile Icon={Cylinder} label="Cylinders" onPress={go('cylinders')} />
              <CircularActionTile Icon={CalendarDays} label="Team calendar" onPress={go('calendar')} />
            </Grid>
          </>
        )}
      </ScrollView>

      <DocumentUploadModal
        visible={showUpload}
        docType={docType}
        pickedFile={pickedFile}
        loading={uploadMutation.isPending}
        error={uploadMutation.isError ? getApiErrorMessage(uploadMutation.error, 'Upload failed. Please try again.') : ''}
        onClose={() => {
          setShowUpload(false);
          setPickedFile(null);
          uploadMutation.reset();
        }}
        onPick={openDocumentPicker}
        onSelectType={setDocType}
        onUpload={() => uploadMutation.mutate()}
      />
    </ScreenContainer>
  );
}

function ComplianceMetric({ label, value, percent }: { label: string; value: string; percent: number }) {
  const { t } = useTheme();
  const width = Math.max(0, Math.min(100, percent));
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Text style={{ color: t.sub, fontSize: 12, flex: 1 }}>{label}</Text>
        <Text style={{ color: t.text, fontSize: 12, fontWeight: '700' }}>{value}</Text>
      </View>
      <View style={{ height: 6, borderRadius: 99, backgroundColor: t.field, overflow: 'hidden' }}>
        <View style={{ width: `${width}%`, height: '100%', backgroundColor: t.primary, borderRadius: 99 }} />
      </View>
    </View>
  );
}

function DocumentRow({ document, last }: { document: ContractorDocument; last: boolean }) {
  const { t } = useTheme();
  const label = DOCUMENT_TYPES.find((item) => item.value === document.doc_type)?.label ?? document.doc_type.replace(/_/g, ' ');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.line }}>
      <IconBadge Icon={document.status === 'verified' ? CheckCircle2 : FileCheck2} tone={document.status === 'verified' ? 'ok' : 'warn'} size={38} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: t.text, fontSize: 13, fontWeight: '700' }}>{label}</Text>
        <Text style={{ color: t.sub, fontSize: 11, marginTop: 3 }}>Uploaded {new Date(document.uploaded_at).toLocaleDateString()}</Text>
      </View>
      <StatusChip status={document.status} size="sm" />
    </View>
  );
}

function DocumentUploadModal({
  visible,
  docType,
  pickedFile,
  loading,
  error,
  onClose,
  onPick,
  onSelectType,
  onUpload,
}: {
  visible: boolean;
  docType: string;
  pickedFile: PickedFile | null;
  loading: boolean;
  error: string;
  onClose: () => void;
  onPick: () => void;
  onSelectType: (type: string) => void;
  onUpload: () => void;
}) {
  const { t } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'center', padding: 18, backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <Surface style={{ padding: 18, maxHeight: '85%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontSize: 17, fontWeight: '800' }}>Upload company document</Text>
              <Text style={{ color: t.sub, fontSize: 12, marginTop: 3 }}>PDF or image, maximum 5 MB.</Text>
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
              <X size={20} color={t.sub} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={{ color: t.sub, fontSize: 12, fontWeight: '700', marginBottom: 8 }}>Document type</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {DOCUMENT_TYPES.map((item) => (
                <Chip key={item.value} variant={docType === item.value ? 'primary' : 'default'} onPress={() => onSelectType(item.value)}>{item.label}</Chip>
              ))}
            </View>
            <Button variant="outline" leftIcon={<Upload size={16} color={t.primary} />} onPress={onPick}>Choose PDF or image</Button>
            {pickedFile ? <Text numberOfLines={2} style={{ color: t.text, fontSize: 12, marginTop: 10 }}>{pickedFile.name}</Text> : null}
            {error ? <Text style={{ color: t.bad, fontSize: 12, marginTop: 10 }}>{error}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <Button variant="outline" onPress={onClose} style={{ flex: 1 }}>Cancel</Button>
              <Button onPress={onUpload} loading={loading} disabled={!pickedFile || loading} style={{ flex: 1 }}>Upload</Button>
            </View>
          </ScrollView>
        </Surface>
      </View>
    </Modal>
  );
}
