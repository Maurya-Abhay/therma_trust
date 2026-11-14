import React, { useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, RefreshControl, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Plus, Wrench } from 'lucide-react-native';
import { format, isValid, parseISO } from 'date-fns';
import { createWorkHistory, fetchRefrigerantTypes, fetchWorkHistory } from '@/src/api/endpoints';
import { RefrigerantType, WorkHistoryEntry } from '@/src/types/api';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { IconBadge, Pill, PortalHero, Section, State, Surface } from '@/src/components/ui/kit';
import { useTheme } from '@/src/theme/ThemeProvider';
import DateTimePicker from '@react-native-community/datetimepicker';

type WorkHistoryForm = {
  equipment_category: string;
  refrigerant_type: number | null;
  job_id: string;
  description: string;
  date: string;
};

const emptyForm = (): WorkHistoryForm => ({
  equipment_category: '',
  refrigerant_type: null,
  job_id: '',
  description: '',
  date: new Date().toISOString().slice(0, 10),
});

export default function WorkHistoryScreen() {
  const queryClient = useQueryClient();
  const { t } = useTheme();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<WorkHistoryForm>(emptyForm);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const historyQuery = useQuery({
    queryKey: ['my-work-history'],
    queryFn: () => fetchWorkHistory('me'),
    staleTime: 30000,
  });
  const refrigerantsQuery = useQuery({
    queryKey: ['refrigerant-types'],
    queryFn: fetchRefrigerantTypes,
    staleTime: 300000,
  });
  const history = historyQuery.data ?? [];
  const refrigerants: RefrigerantType[] = refrigerantsQuery.data ?? [];

  const createMutation = useMutation({
    mutationFn: () => createWorkHistory({
      equipment_category: form.equipment_category.trim(),
      refrigerant_type: form.refrigerant_type,
      job: form.job_id.trim() ? Number(form.job_id) : null,
      description: form.description.trim(),
      date: form.date.trim(),
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['my-work-history'] });
      setShowAdd(false);
      setForm(emptyForm());
      Alert.alert('Saved', 'Work history entry added.');
    },
    onError: (error: any) => Alert.alert('Error', error.response?.data?.detail || 'Could not add this work history entry.'),
  });

  const submit = () => {
    if (!form.equipment_category.trim() || !form.description.trim()) {
      Alert.alert('Missing details', 'Add an equipment category and description.');
      return;
    }
    const parsedDate = parseISO(form.date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date) || !isValid(parsedDate) || format(parsedDate, 'yyyy-MM-dd') !== form.date) {
      Alert.alert('Invalid date', 'Enter a valid date in YYYY-MM-DD format.');
      return;
    }
    if (form.job_id.trim() && (!/^\d+$/.test(form.job_id) || Number(form.job_id) < 1)) {
      Alert.alert('Invalid job', 'Enter a valid job ID or leave it blank.');
      return;
    }
    createMutation.mutate();
  };

  const renderEntry = ({ item }: { item: WorkHistoryEntry }) => (
    <Surface style={{ marginHorizontal: 18, marginBottom: 10, padding: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconBadge Icon={Wrench} size={40} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: t.text, fontSize: 14, fontWeight: '800' }}>{item.equipment_category}</Text>
          <Text style={{ color: t.sub, fontSize: 11 }}>{format(new Date(item.date), 'd MMM yyyy')}{item.refrigerant_type ? ` · ${refrigerants.find((type) => type.id === item.refrigerant_type)?.code ?? `Refrigerant #${item.refrigerant_type}`}` : ''}</Text>
        </View>
        {item.job ? <Pill text={`Job #${item.job}`} tone="info" /> : null}
      </View>
      <Text style={{ color: t.text, fontSize: 13, lineHeight: 19, marginTop: 11 }}>{item.description}</Text>
    </Surface>
  );

  return (
    <ScreenContainer headerTitle="Work History" showProfile={false} contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <FlatList
          data={history}
          renderItem={renderEntry}
          keyExtractor={(item) => String(item.id)}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={historyQuery.isRefetching} onRefresh={() => { void historyQuery.refetch(); }} tintColor={t.primary} colors={[t.primary]} />}
          contentContainerStyle={{ paddingBottom: 28, flexGrow: 1 }}
          ListHeaderComponent={
            <View style={{ paddingHorizontal: 18, paddingTop: 16 }}>
              <PortalHero eyebrow="EXPERIENCE LOG" title="Work history" subtitle="Review completed service work and record relevant experience." Icon={ClipboardList} />
              <View style={{ marginTop: 14 }}>
                <Surface style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={{ color: t.text, fontSize: 17, fontWeight: '800' }}>{history.length}</Text>
                    <Text style={{ color: t.sub, fontSize: 11 }}>recorded entries</Text>
                  </View>
                  <Button size="sm" leftIcon={<Plus size={15} color="#FFFFFF" />} onPress={() => setShowAdd((value) => !value)}>
                    {showAdd ? 'Close form' : 'Add entry'}
                  </Button>
                </Surface>
              </View>
              {historyQuery.isLoading || (historyQuery.isError && history.length === 0) ? (
                <View style={{ marginTop: 12 }}><State loading={historyQuery.isLoading} error={historyQuery.isError} onRetry={() => { void historyQuery.refetch(); }} /></View>
              ) : null}
              {showAdd ? (
                <>
                  <Section title="New work entry" />
                  <Surface style={{ gap: 12 }}>
                    <Input label="Equipment category *" placeholder="e.g. Chiller, VRF, split system" value={form.equipment_category} onChangeText={(value) => setForm((current) => ({ ...current, equipment_category: value }))} />
                    <View>
                      <Text style={{ color: t.sub, fontSize: 12, fontWeight: '700', marginBottom: 8 }}>Refrigerant type</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                        <Pressable onPress={() => setForm((current) => ({ ...current, refrigerant_type: null }))} style={{ paddingHorizontal: 11, paddingVertical: 7, borderRadius: 99, borderWidth: 1, borderColor: form.refrigerant_type === null ? t.primary : t.line, backgroundColor: form.refrigerant_type === null ? t.tint : t.card }}>
                          <Text style={{ color: form.refrigerant_type === null ? t.primary : t.sub, fontSize: 11, fontWeight: '700' }}>None</Text>
                        </Pressable>
                        {refrigerants.map((item) => (
                          <Pressable key={item.id} onPress={() => setForm((current) => ({ ...current, refrigerant_type: item.id }))} style={{ paddingHorizontal: 11, paddingVertical: 7, borderRadius: 99, borderWidth: 1, borderColor: form.refrigerant_type === item.id ? t.primary : t.line, backgroundColor: form.refrigerant_type === item.id ? t.tint : t.card }}>
                            <Text style={{ color: form.refrigerant_type === item.id ? t.primary : t.sub, fontSize: 11, fontWeight: '700' }}>{item.code}</Text>
                          </Pressable>
                        ))}
                      </View>
                      {refrigerantsQuery.isError ? <Text style={{ color: t.bad, fontSize: 11, marginTop: 7 }}>Refrigerant options could not be loaded.</Text> : null}
                    </View>
                    <Input label="Linked job ID (optional)" placeholder="Enter a job number" keyboardType="number-pad" value={form.job_id} onChangeText={(value) => setForm((current) => ({ ...current, job_id: value }))} />
                    <View>
                      <Text style={{ color: t.sub, fontSize: 12, fontWeight: '700', marginBottom: 8 }}>Date *</Text>
                      <Pressable onPress={() => setShowDatePicker(true)} style={{ borderWidth: 1, borderColor: t.line, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 13, backgroundColor: t.card }}>
                        <Text style={{ color: t.text, fontSize: 14 }}>{form.date}</Text>
                      </Pressable>
                      {showDatePicker ? (
                        <DateTimePicker
                          value={parseISO(form.date)}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          onChange={(_, selected) => {
                            if (Platform.OS !== 'ios') setShowDatePicker(false);
                            if (selected) setForm((current) => ({ ...current, date: format(selected, 'yyyy-MM-dd') }));
                          }}
                        />
                      ) : null}
                    </View>
                    <Input label="Description *" placeholder="Describe the work performed" multiline numberOfLines={4} value={form.description} onChangeText={(value) => setForm((current) => ({ ...current, description: value }))} />
                    <View style={{ flexDirection: 'row', gap: 9 }}>
                      <Button style={{ flex: 1 }} variant="outline" onPress={() => setShowAdd(false)}>Cancel</Button>
                      <Button style={{ flex: 1 }} loading={createMutation.isPending} onPress={submit}>Save entry</Button>
                    </View>
                  </Surface>
                </>
              ) : null}
              <Section title="Your experience" action={history.length ? `${history.length} entries` : undefined} />
            </View>
          }
          ListEmptyComponent={!historyQuery.isLoading && !historyQuery.isError ? <View style={{ alignItems: 'center', paddingHorizontal: 28, paddingTop: 24 }}><IconBadge Icon={ClipboardList} size={54} /><Text style={{ color: t.text, fontSize: 15, fontWeight: '800', marginTop: 12 }}>No work history yet</Text><Text style={{ color: t.sub, fontSize: 12, textAlign: 'center', marginTop: 5 }}>Add a service record to keep your experience up to date.</Text></View> : undefined}
        />
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
