import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { addMonths, eachDayOfInterval, endOfDay, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek, subMonths } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { fetchScheduledJobs } from '@/src/api/endpoints';
import { JobRequest } from '@/src/types/api';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { RiskChip, StatusChip } from '@/src/components/ui/Chip';
import { IconBadge, PortalHero, Section, State, Surface } from '@/src/components/ui/kit';
import { useTheme } from '@/src/theme/ThemeProvider';

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function JobCalendarScreen({
  scope,
  title,
  subtitle,
  jobRoute,
}: {
  scope: 'technician' | 'contractor' | 'facility_manager';
  title: string;
  subtitle: string;
  jobRoute?: (jobId: number) => Href;
}) {
  const router = useRouter();
  const { t } = useTheme();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());
  const monthStart = startOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const query = useQuery({
    queryKey: ['job-calendar', scope, format(monthStart, 'yyyy-MM')],
    queryFn: () => fetchScheduledJobs(gridStart.toISOString(), endOfDay(gridEnd).toISOString()),
  });
  const jobs = query.data ?? [];
  const jobsByDay = useMemo(() => {
    const map: Record<string, JobRequest[]> = {};
    for (const job of jobs) {
      if (!job.scheduled_for) continue;
      const key = format(new Date(job.scheduled_for), 'yyyy-MM-dd');
      (map[key] ??= []).push(job);
    }
    return map;
  }, [jobs]);
  const selectedJobs = selectedDay ? jobsByDay[format(selectedDay, 'yyyy-MM-dd')] ?? [] : [];

  const changeMonth = (next: Date) => {
    setCurrentMonth(next);
    setSelectedDay(null);
  };

  return (
    <ScreenContainer headerTitle="Calendar" showProfile={false} contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: 28 }}>
        <PortalHero
          eyebrow={scope === 'technician' ? 'YOUR SCHEDULE' : scope === 'contractor' ? 'TEAM SCHEDULE' : 'FACILITY SCHEDULE'}
          title={title}
          subtitle={subtitle}
          Icon={CalendarDays}
        />

        <Surface style={{ marginTop: 14, padding: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              onPress={() => changeMonth(subMonths(currentMonth, 1))}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.field, alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronLeft size={20} color={t.text} />
            </Pressable>
            <Text style={{ color: t.text, fontSize: 16, fontWeight: '800' }}>{format(currentMonth, 'MMMM yyyy')}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next month"
              onPress={() => changeMonth(addMonths(currentMonth, 1))}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.field, alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronRight size={20} color={t.text} />
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
            {WEEK_DAYS.map((day) => (
              <Text key={day} style={{ width: '14.2857%', color: t.sub, textAlign: 'center', fontSize: 10, fontWeight: '700' }}>{day}</Text>
            ))}
          </View>

          {query.isLoading ? <State loading /> : query.isError ? (
            <State error onRetry={() => { void query.refetch(); }} />
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {days.map((day) => {
                const key = format(day, 'yyyy-MM-dd');
                const count = jobsByDay[key]?.length ?? 0;
                const selected = !!selectedDay && isSameDay(day, selectedDay);
                const today = isToday(day);
                const inMonth = isSameMonth(day, currentMonth);
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityLabel={`${format(day, 'EEEE, MMMM d')}${count ? `, ${count} scheduled jobs` : ''}`}
                    accessibilityState={{ selected }}
                    onPress={() => setSelectedDay(day)}
                    style={{
                      width: '14.2857%',
                      height: 48,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 13,
                      backgroundColor: selected ? t.primary : today ? t.tint : 'transparent',
                      opacity: inMonth ? 1 : 0.42,
                    }}
                  >
                    <Text style={{ color: selected ? '#FFFFFF' : t.text, fontSize: 13, fontWeight: today || selected ? '800' : '600' }}>{format(day, 'd')}</Text>
                    {count > 0 ? <View style={{ width: 5, height: 5, borderRadius: 3, marginTop: 2, backgroundColor: selected ? '#FFFFFF' : t.primary }} /> : <View style={{ height: 5, marginTop: 2 }} />}
                  </Pressable>
                );
              })}
            </View>
          )}
        </Surface>

        {selectedDay ? (
          <>
            <Section title={format(selectedDay, 'EEEE, d MMMM')} action={`${selectedJobs.length} jobs`} />
            {selectedJobs.length ? selectedJobs.map((job) => (
              <Surface
                key={job.id}
                onPress={jobRoute ? () => router.push(jobRoute(job.id)) : undefined}
                style={{ marginBottom: 9, flexDirection: 'row', alignItems: 'center', gap: 10 }}
              >
                <IconBadge Icon={CalendarDays} size={40} />
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <Text numberOfLines={1} style={{ color: t.text, fontSize: 13, fontWeight: '800' }}>{job.equipment_name}</Text>
                  <Text numberOfLines={1} style={{ color: t.sub, fontSize: 11 }}>{job.facility_name} · {format(new Date(job.scheduled_for!), 'h:mm a')}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 3 }}>
                    <StatusChip status={job.status} size="sm" />
                    <RiskChip risk={job.risk_level} size="sm" />
                  </View>
                </View>
                {jobRoute ? <ChevronRight size={18} color={t.sub} /> : null}
              </Surface>
            )) : <Surface><Text style={{ color: t.sub, textAlign: 'center', fontSize: 12 }}>No jobs scheduled for this day.</Text></Surface>}
          </>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}
