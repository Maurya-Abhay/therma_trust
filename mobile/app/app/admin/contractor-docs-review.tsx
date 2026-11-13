import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Building2, CalendarDays, Clock3, FileText } from 'lucide-react-native';
import { fetchAllContractorDocuments } from '@/src/api/endpoints';
import { ContractorDocument } from '@/src/types/api';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { StatusChip } from '@/src/components/ui/Chip';
import { IconBadge, PortalHero, Section, State, Stat, Surface } from '@/src/components/ui/kit';
import { useTheme } from '@/src/theme/ThemeProvider';

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Verified', value: 'verified' },
  { label: 'Rejected', value: 'rejected' },
] as const;

export default function ContractorDocsReviewScreen() {
  const { t } = useTheme();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const {
    data: documents = [],
    isLoading,
    isError,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['admin-contractor-docs'],
    queryFn: fetchAllContractorDocuments,
    staleTime: 30000,
  });

  const filtered = documents.filter((item) => statusFilter === 'all' || item.status === statusFilter);
  const pendingCount = documents.filter((item) => item.status === 'pending').length;
  const verifiedCount = documents.filter((item) => item.status === 'verified').length;
  const showLoadError = isError && documents.length === 0;

  const renderDocument = ({ item }: { item: ContractorDocument }) => (
    <Surface style={{ marginHorizontal: 18, marginBottom: 12, padding: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
        <IconBadge Icon={FileText} size={42} />
        <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
          <Text numberOfLines={2} style={{ color: t.text, fontSize: 14, fontWeight: '800' }}>{item.doc_type}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Building2 size={13} color={t.sub} />
            <Text numberOfLines={1} style={{ flex: 1, color: t.sub, fontSize: 11 }}>{item.company_name}</Text>
          </View>
        </View>
        <StatusChip status={item.status} size="sm" />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 13, paddingTop: 11, borderTopWidth: 1, borderTopColor: t.line }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <CalendarDays size={15} color={t.sub} />
          <Text style={{ color: t.sub, fontSize: 11 }}>Uploaded</Text>
        </View>
        <Text style={{ color: t.text, fontSize: 12, fontWeight: '700' }}>
          {item.uploaded_at ? new Date(item.uploaded_at).toLocaleDateString() : 'Date unavailable'}
        </Text>
      </View>
    </Surface>
  );

  return (
    <ScreenContainer
      headerTitle="Company Documents"
      showBack
      showProfile={false}
      contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}
    >
      <FlatList
        data={filtered}
        renderItem={renderDocument}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => { void refetch(); }}
            tintColor={t.primary}
            colors={[t.primary]}
          />
        }
        contentContainerStyle={{ paddingBottom: 28, flexGrow: 1 }}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 18, paddingTop: 16 }}>
            <PortalHero
              eyebrow="ADMIN REVIEW"
              title="Verification queue"
              subtitle="Review uploaded company documents and their verification status."
              Icon={FileText}
            />
            {isLoading || showLoadError ? (
              <View style={{ marginTop: 16 }}><State loading={isLoading} error={showLoadError} onRetry={() => { void refetch(); }} /></View>
            ) : (
              <>
                <View style={{ flexDirection: 'row', gap: 9, marginTop: 16 }}>
                  <Stat Icon={FileText} value={documents.length} label="Total" />
                  <Stat Icon={Clock3} value={pendingCount} label="Pending" tone="warn" />
                  <Stat Icon={Building2} value={verifiedCount} label="Verified" tone="ok" />
                </View>
                <Section title="Document status" action={`${filtered.length} results`} />
                <FlatList
                  horizontal
                  data={FILTERS}
                  keyExtractor={(item) => item.value}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
                  renderItem={({ item }) => {
                    const active = statusFilter === item.value;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        onPress={() => setStatusFilter(item.value)}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: active ? t.primary : t.line,
                          backgroundColor: active ? t.primary : t.card,
                        }}
                      >
                        <Text style={{ color: active ? '#FFFFFF' : t.sub, fontSize: 11, fontWeight: '700' }}>{item.label}</Text>
                      </Pressable>
                    );
                  }}
                />
              </>
            )}
          </View>
        }
        ListEmptyComponent={
          !isLoading && !showLoadError ? (
            <View style={{ alignItems: 'center', paddingHorizontal: 28, paddingTop: 40 }}>
              <IconBadge Icon={FileText} size={54} />
              <Text style={{ color: t.text, fontSize: 15, fontWeight: '800', marginTop: 12 }}>No documents found</Text>
              <Text style={{ color: t.sub, fontSize: 12, textAlign: 'center', marginTop: 5 }}>
                No company documents match this status.
              </Text>
            </View>
          ) : undefined
        }
      />
    </ScreenContainer>
  );
}
