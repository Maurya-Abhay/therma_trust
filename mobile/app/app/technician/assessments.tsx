import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ChevronRight, ClipboardCheck, FileQuestion, Target } from 'lucide-react-native';
import { fetchAssessments } from '@/src/api/endpoints';
import { Assessment } from '@/src/types/api';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { IconBadge, Pill, PortalHero, Section, State, Stat, Surface } from '@/src/components/ui/kit';
import { useTheme } from '@/src/theme/ThemeProvider';

type Category = 'all' | 'equipment' | 'refrigerant' | 'safety';
const FILTERS: { label: string; value: Category }[] = [
  { label: 'All', value: 'all' },
  { label: 'Equipment', value: 'equipment' },
  { label: 'Refrigerant', value: 'refrigerant' },
  { label: 'Safety', value: 'safety' },
];

export default function AssessmentsScreen() {
  const router = useRouter();
  const { t } = useTheme();
  const [category, setCategory] = useState<Category>('all');
  const {
    data: assessments = [],
    isLoading,
    isError,
    isRefetching,
    refetch,
  } = useQuery({ queryKey: ['assessments'], queryFn: fetchAssessments, staleTime: 60000 });

  const filtered = assessments.filter((item) => category === 'all' || item.capability_type === category);
  const showLoadError = isError && assessments.length === 0;
  const renderAssessment = ({ item }: { item: Assessment }) => (
    <View style={{ width: '100%', paddingHorizontal: 18, marginBottom: 12 }}>
    <Surface onPress={() => router.push(`/app/technician/assessments/${item.id}` as any)} style={{ width: '100%', padding: 16, borderLeftWidth: 3, borderLeftColor: t.primary }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconBadge Icon={ClipboardCheck} size={42} />
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text numberOfLines={2} style={{ color: t.text, fontSize: 14, fontWeight: '800' }}>{item.title}</Text>
          <Text numberOfLines={1} style={{ color: t.sub, fontSize: 11 }}>{item.target_label}</Text>
        </View>
        <ChevronRight size={19} color={t.primary} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 13 }}>
        <Pill text="Ready to start" tone="ok" />
        <Text style={{ color: t.primary, fontSize: 12, fontWeight: '800' }}>Open assessment</Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: t.line }}>
        <Pill text={item.capability_type} tone="info" />
        <Pill text={`Pass mark ${item.pass_score_percent}%`} tone="primary" />
        <Pill text={`${item.questions.length} questions`} tone="primary" />
        <Pill text={`~${Math.ceil(item.questions.length * 1.5)} min`} tone="primary" />
      </View>
    </Surface>
    </View>
  );

  return (
    <ScreenContainer headerTitle="Assessments" showProfile={false} contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <FlatList
        data={filtered}
        renderItem={renderAssessment}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { void refetch(); }} tintColor={t.primary} colors={[t.primary]} />}
        contentContainerStyle={{ paddingBottom: 28, flexGrow: 1 }}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 18, paddingTop: 16 }}>
            <PortalHero eyebrow="LEARNING & SKILLS" title="Assessments" subtitle="Check your knowledge and demonstrate your capabilities." Icon={ClipboardCheck} />
            {isLoading || showLoadError ? (
              <View style={{ marginTop: 16 }}><State loading={isLoading} error={showLoadError} onRetry={() => { void refetch(); }} /></View>
            ) : (
              <>
                <View style={{ flexDirection: 'row', gap: 9, marginTop: 16 }}>
                  <Stat Icon={ClipboardCheck} value={assessments.length} label="Available" />
                  <Stat Icon={Target} value={filtered.length} label="Showing" tone="info" />
                  <Stat Icon={FileQuestion} value={assessments.reduce((total, item) => total + item.questions.length, 0)} label="Questions" tone="warn" />
                </View>
                <Section title="Available assessments" />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 12 }}>
                  {FILTERS.map((item) => {
                    const active = category === item.value;
                    return (
                      <Pressable key={item.value} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => setCategory(item.value)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: active ? t.primary : t.line, backgroundColor: active ? t.primary : t.card }}>
                        <Text style={{ color: active ? '#FFFFFF' : t.sub, fontSize: 11, fontWeight: '700' }}>{item.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
          </View>
        }
        ListEmptyComponent={!isLoading && !showLoadError ? <State empty={category === 'all' ? 'No assessments are available right now.' : `No ${category} assessments available.`} /> : undefined}
      />
    </ScreenContainer>
  );
}
