import React, { useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Bell, BriefcaseBusiness, Check, ClipboardList, FileBadge, Star } from 'lucide-react-native';
import { format } from 'date-fns';
import { fetchNotifications, markNotificationsRead } from '@/src/api/endpoints';
import { AppNotification } from '@/src/types/api';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { Button } from '@/src/components/ui/Button';
import { IconBadge, PortalHero, Section, State, Surface } from '@/src/components/ui/kit';
import { useTheme } from '@/src/theme/ThemeProvider';

const KIND_ICONS = {
  job: BriefcaseBusiness,
  credential: FileBadge,
  report: ClipboardList,
  feedback: Star,
  info: Bell,
} as const;

export default function NotificationsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTheme();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectMode, setSelectMode] = useState(false);

  const {
    data: notifications = [],
    isLoading,
    isError,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    select: (response) => response.results,
    staleTime: 30000,
  });

  const markReadMutation = useMutation({
    mutationFn: (value: number[] | 'all') => markNotificationsRead(value === 'all' ? { all: true } : { ids: value }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setSelectedIds([]);
      setSelectMode(false);
    },
    onError: (error: any) => Alert.alert('Error', error.response?.data?.detail || 'Could not update notifications.'),
  });

  const toggleSelect = (id: number) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  };
  const unreadCount = notifications.filter((item) => !item.read).length;
  const showLoadError = isError && notifications.length === 0;

  const openNotification = (item: AppNotification) => {
    if (selectMode) {
      toggleSelect(item.id);
    } else if (item.link) {
      router.push(item.link as any);
    }
  };

  const renderNotification = ({ item }: { item: AppNotification }) => {
    const Icon = KIND_ICONS[item.kind] ?? Bell;
    const selected = selectedIds.includes(item.id);
    return (
      <View style={{ width: '90%', alignSelf: 'center', marginBottom: 11 }}>
      <Pressable
        onPress={() => openNotification(item)}
        onLongPress={() => {
          setSelectMode(true);
          setSelectedIds((current) => current.includes(item.id) ? current : [...current, item.id]);
        }}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        style={({ pressed }) => ({
          width: '100%',
          minHeight: 88,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 11,
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: selected ? t.primary : t.line,
          backgroundColor: selected ? t.tint : t.card,
          opacity: pressed ? 0.84 : 1,
        })}
      >
        <IconBadge Icon={Icon} tone={item.read ? 'primary' : 'info'} size={40} />
        <View style={{ flex: 1, minWidth: 0, gap: 4, justifyContent: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text numberOfLines={1} style={{ flex: 1, color: t.text, fontSize: 13, fontWeight: '800' }}>{item.title}</Text>
            {!item.read ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.primary }} /> : null}
          </View>
          <Text numberOfLines={2} style={{ color: t.sub, fontSize: 12, lineHeight: 17 }}>{item.body}</Text>
          <Text style={{ color: t.sub, fontSize: 10 }}>{format(new Date(item.created_at), 'd MMM yyyy, h:mm a')}</Text>
        </View>
        {selectMode ? (
          <View style={{ width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: selected ? t.primary : t.line, backgroundColor: selected ? t.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {selected ? <Check size={14} color="#FFFFFF" /> : null}
          </View>
        ) : null}
      </Pressable>
      </View>
    );
  };

  return (
    <ScreenContainer headerTitle="Notifications" showProfile={false} contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { void refetch(); }} tintColor={t.primary} colors={[t.primary]} />}
        contentContainerStyle={{ paddingBottom: 28, flexGrow: 1 }}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 18, paddingTop: 16 }}>
            <PortalHero eyebrow="UPDATES" title="Notifications" subtitle="Stay up to date with assignments and account activity." Icon={Bell} />
            {isLoading || showLoadError ? (
              <View style={{ marginTop: 16 }}><State loading={isLoading} error={showLoadError} onRetry={() => { void refetch(); }} /></View>
            ) : (
              <>
                <View style={{ marginTop: 14 }}>
                  <Surface style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <View>
                      <Text style={{ color: t.text, fontSize: 14, fontWeight: '800' }}>{unreadCount} unread</Text>
                      <Text style={{ color: t.sub, fontSize: 11, marginTop: 3 }}>{notifications.length} total updates</Text>
                    </View>
                    {selectMode ? (
                      <View style={{ flexDirection: 'row', gap: 7 }}>
                        <Button size="sm" variant="outline" onPress={() => { setSelectMode(false); setSelectedIds([]); }}>Cancel</Button>
                        <Button size="sm" loading={markReadMutation.isPending} disabled={!selectedIds.length} onPress={() => markReadMutation.mutate(selectedIds)}>Mark read</Button>
                      </View>
                    ) : (
                      <Button size="sm" variant="outline" disabled={!unreadCount || markReadMutation.isPending} loading={markReadMutation.isPending} onPress={() => markReadMutation.mutate('all')}>Mark all read</Button>
                    )}
                  </Surface>
                </View>
                <Section title={selectMode ? `${selectedIds.length} selected` : 'Recent activity'} />
              </>
            )}
          </View>
        }
        ListEmptyComponent={!isLoading && !showLoadError ? <View style={{ paddingTop: 28, alignItems: 'center' }}><IconBadge Icon={Bell} size={54} /><Text style={{ color: t.text, fontSize: 15, fontWeight: '800', marginTop: 12 }}>You are all caught up</Text><Text style={{ color: t.sub, fontSize: 12, marginTop: 5 }}>New updates will appear here.</Text></View> : undefined}
      />
    </ScreenContainer>
  );
}
