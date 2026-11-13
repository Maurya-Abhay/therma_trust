import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, Pressable, Text, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Building2, ClipboardList, Cylinder, FileCheck2, Search as SearchIcon, UserRound, Wrench, X, LucideIcon } from 'lucide-react-native';
import { searchEverything } from '@/src/api/endpoints';
import { SearchResult } from '@/src/types/api';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { IconBadge, Pill, Row, Section, State, Surface } from '@/src/components/ui/kit';
import { useTheme } from '@/src/theme/ThemeProvider';

const TYPE_ICONS: Record<SearchResult['type'], LucideIcon> = {
  facility: Building2,
  equipment: Wrench,
  job: ClipboardList,
  technician: UserRound,
  cylinder: Cylinder,
  credential: FileCheck2,
};

const SEARCH_TYPES: SearchResult['type'][] = ['facility', 'equipment', 'job', 'technician', 'cylinder', 'credential'];
const TYPE_LABELS: Record<SearchResult['type'], string> = {
  facility: 'Facility',
  equipment: 'Equipment',
  job: 'Job',
  technician: 'Technician',
  cylinder: 'Cylinder',
  credential: 'Credential',
};

export default function SearchScreen() {
  const router = useRouter();
  const { t } = useTheme();
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim();
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(normalizedQuery), 300);
    return () => clearTimeout(timeout);
  }, [normalizedQuery]);

  const shouldSearch = debouncedQuery.length >= 2;
  const isDebouncing = normalizedQuery.length >= 2 && normalizedQuery !== debouncedQuery;
  const {
    data: results = [],
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => searchEverything(debouncedQuery),
    enabled: shouldSearch,
    staleTime: 30000,
  });

  const openResult = (result: SearchResult) => {
    Keyboard.dismiss();
    router.push(result.link as any);
  };

  const showResults = normalizedQuery.length >= 2 && normalizedQuery === debouncedQuery && !isFetching && !isError;

  return (
    <ScreenContainer
      headerTitle="Search"
      showBack
      showProfile={false}
      contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}
    >
      <FlatList
        data={showResults ? results : []}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 28, flexGrow: 1 }}
        renderItem={({ item }) => (
          <Surface style={{ marginHorizontal: 18, marginBottom: 8, paddingVertical: 0 }}>
            <Row
              Icon={TYPE_ICONS[item.type]}
              title={item.title}
              sub={item.subtitle}
              right={<Pill text={TYPE_LABELS[item.type]} tone="info" />}
              onPress={() => openResult(item)}
              last
            />
          </Surface>
        )}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 18, paddingTop: 16 }}>
            <Surface style={{ padding: 0, borderRadius: 16 }}>
              <View style={{ minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 }}>
                <SearchIcon size={20} color={t.primary} />
                <TextInput
                  accessibilityLabel="Search facilities, equipment, jobs, technicians, cylinders, and credentials"
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                  placeholder="What are you looking for?"
                  placeholderTextColor={t.sub}
                  selectionColor={t.primary}
                  value={query}
                  onChangeText={setQuery}
                  style={{ flex: 1, minWidth: 0, minHeight: 52, color: t.text, fontSize: 14 }}
                />
                {query.length ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Clear search"
                    hitSlop={8}
                    onPress={() => setQuery('')}
                    style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: t.field, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <X size={17} color={t.sub} />
                  </Pressable>
                ) : null}
              </View>
            </Surface>

            {normalizedQuery.length < 2 ? (
              <>
                <Section title="Search across" />
                <Surface style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {SEARCH_TYPES.map((type) => <Pill key={type} text={TYPE_LABELS[type]} tone="primary" />)}
                </Surface>
                <View style={{ alignItems: 'center', paddingHorizontal: 18, paddingTop: 38 }}>
                  <IconBadge Icon={SearchIcon} size={56} />
                  <Text style={{ color: t.text, fontSize: 15, fontWeight: '800', marginTop: 12 }}>Find it faster</Text>
                  <Text style={{ color: t.sub, fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 5 }}>
                    Enter at least 2 characters to search your workspace.
                  </Text>
                </View>
              </>
            ) : isDebouncing || isFetching ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingVertical: 28 }}>
                <ActivityIndicator size="small" color={t.primary} />
                <Text style={{ color: t.sub, fontSize: 12 }}>Searching your workspace…</Text>
              </View>
            ) : isError ? (
              <View style={{ marginTop: 18 }}>
                <State error onRetry={() => { void refetch(); }} />
              </View>
            ) : (
              <Section title={`Results for "${normalizedQuery}"`} action={`${results.length} found`} />
            )}
          </View>
        }
        ListEmptyComponent={
          showResults ? (
            <View style={{ alignItems: 'center', paddingHorizontal: 28, paddingTop: 30 }}>
              <IconBadge Icon={SearchIcon} size={50} />
              <Text style={{ color: t.text, fontSize: 14, fontWeight: '800', marginTop: 10 }}>No results found</Text>
              <Text style={{ color: t.sub, fontSize: 12, textAlign: 'center', marginTop: 4 }}>
                Try a different name or search term.
              </Text>
            </View>
          ) : undefined
        }
      />
    </ScreenContainer>
  );
}
