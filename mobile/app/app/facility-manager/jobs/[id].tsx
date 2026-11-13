import React from 'react';
import { Alert, Modal, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BriefcaseBusiness, CalendarClock, Download, FileCheck2, Star, Wrench } from 'lucide-react-native';
import { format, isValid } from 'date-fns';
import {
  approveServiceReport,
  assignJob,
  downloadServiceReportPdf,
  fetchJob,
  fetchJobMatches,
  fetchServiceReports,
  rejectServiceReport,
  scheduleJob,
  submitJobFeedback,
} from '@/src/api/endpoints';
import { getApiErrorMessage } from '@/src/api/errorMessage';
import type { JobMatch, ServiceReport } from '@/src/types/api';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { Button } from '@/src/components/ui/Button';
import { Chip, RiskChip, StatusChip } from '@/src/components/ui/Chip';
import { Input } from '@/src/components/ui/Input';
import { IconBadge, PortalHero, Section, State, Surface } from '@/src/components/ui/kit';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useToast } from '@/src/components/ui/Toast';
import { saveAndShareFile } from '@/src/nativeFiles';

export default function FacilityManagerJobDetailScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const jobId = Number(rawId);
  const validId = Number.isSafeInteger(jobId) && jobId > 0;
  const queryClient = useQueryClient();
  const { t } = useTheme();
  const { show } = useToast();
  const [scheduleValue, setScheduleValue] = React.useState('');
  const [scheduleError, setScheduleError] = React.useState('');
  const [overrideTarget, setOverrideTarget] = React.useState<JobMatch | null>(null);
  const [overrideReason, setOverrideReason] = React.useState('');
  const [rating, setRating] = React.useState(0);
  const [feedbackComment, setFeedbackComment] = React.useState('');

  const jobQuery = useQuery({
    queryKey: ['fm-job', jobId],
    queryFn: () => fetchJob(jobId),
    enabled: validId,
  });
  const job = jobQuery.data;
  const matchesQuery = useQuery({
    queryKey: ['fm-job-matches', jobId],
    queryFn: () => fetchJobMatches(jobId),
    enabled: !!job && job.status === 'open' && !job.assignment,
  });
  const reportsQuery = useQuery({
    queryKey: ['service-reports', jobId],
    queryFn: () => fetchServiceReports({ job: jobId }),
    enabled: !!job && job.status !== 'open',
  });

  const refresh = () => {
    void Promise.all([jobQuery.refetch(), matchesQuery.refetch(), reportsQuery.refetch()]);
  };
  const invalidateJobData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['fm-job', jobId] }),
      queryClient.invalidateQueries({ queryKey: ['fm-job-matches', jobId] }),
      queryClient.invalidateQueries({ queryKey: ['service-reports', jobId] }),
      queryClient.invalidateQueries({ queryKey: ['fm-jobs'] }),
      queryClient.invalidateQueries({ queryKey: ['jobs'] }),
      queryClient.invalidateQueries({ queryKey: ['job-calendar'] }),
    ]);
  };

  const scheduleMutation = useMutation({
    mutationFn: (value: string | null) => scheduleJob(jobId, value),
    onSuccess: async () => {
      setScheduleValue('');
      setScheduleError('');
      show('Job schedule updated.', 'success');
      await invalidateJobData();
    },
  });
  const assignMutation = useMutation({
    mutationFn: ({ technicianId, override, reason }: { technicianId: number; override: boolean; reason: string }) =>
      assignJob(jobId, technicianId, override, reason),
    onSuccess: async () => {
      setOverrideTarget(null);
      setOverrideReason('');
      show('Technician assigned.', 'success');
      await invalidateJobData();
    },
  });
  const approveMutation = useMutation({
    mutationFn: (reportId: number) => approveServiceReport(reportId),
    onSuccess: async () => {
      show('Service report approved.', 'success');
      await invalidateJobData();
    },
  });
  const rejectMutation = useMutation({
    mutationFn: (reportId: number) => rejectServiceReport(reportId),
    onSuccess: async () => {
      show('Service report returned to the technician.', 'success');
      await invalidateJobData();
    },
  });
  const feedbackMutation = useMutation({
    mutationFn: () => submitJobFeedback(jobId, rating, feedbackComment.trim()),
    onSuccess: async () => {
      show('Your feedback was saved.', 'success');
      setRating(0);
      setFeedbackComment('');
      await invalidateJobData();
    },
  });
  const pdfMutation = useMutation({
    mutationFn: async (reportId: number) => {
      const pdf = await downloadServiceReportPdf(reportId);
      return saveAndShareFile(pdf, `service-report-job-${jobId}-${reportId}.pdf`, 'application/pdf', 'Save service report PDF');
    },
    onSuccess: (shared) => show(shared ? 'Service report PDF is ready.' : 'PDF saved to app storage, but sharing is unavailable.', shared ? 'success' : 'info'),
  });

  const saveSchedule = () => {
    const value = scheduleValue.trim();
    const date = new Date(value);
    if (!value || !isValid(date)) {
      setScheduleError('Enter a valid date and time, such as 2026-11-13T14:30.');
      return;
    }
    setScheduleError('');
    scheduleMutation.mutate(date.toISOString());
  };

  const handleAssign = (match: JobMatch) => {
    if (match.is_qualified) {
      Alert.alert('Assign technician', `Assign ${match.name} to this job?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Assign', onPress: () => assignMutation.mutate({ technicianId: match.technician_id, override: false, reason: '' }) },
      ]);
      return;
    }
    setOverrideTarget(match);
    setOverrideReason('');
  };

  const confirmReportAction = (report: ServiceReport, action: 'approve' | 'reject') => {
    const approve = action === 'approve';
    Alert.alert(
      approve ? 'Approve service report?' : 'Return service report?',
      approve ? 'Approving the report completes this job.' : 'The technician will need to update and resubmit the report.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: approve ? 'Approve' : 'Return', style: approve ? 'default' : 'destructive', onPress: () => (approve ? approveMutation.mutate(report.id) : rejectMutation.mutate(report.id)) },
      ],
    );
  };

  if (!validId) return <ScreenContainer headerTitle="Job details"><State empty="Invalid job reference." /></ScreenContainer>;
  if (jobQuery.isLoading) return <ScreenContainer headerTitle="Job details"><State loading /></ScreenContainer>;
  if (jobQuery.isError || !job) return <ScreenContainer headerTitle="Job details"><State error onRetry={refresh} /></ScreenContainer>;

  const reports = reportsQuery.data ?? [];
  const scheduledDate = job.scheduled_for ? new Date(job.scheduled_for) : null;
  const refreshing = jobQuery.isRefetching || matchesQuery.isRefetching || reportsQuery.isRefetching;
  const mutationError = assignMutation.error ?? scheduleMutation.error ?? approveMutation.error ?? rejectMutation.error ?? feedbackMutation.error ?? pdfMutation.error;

  return (
    <ScreenContainer headerTitle={`Job #${job.id}`} headerSubtitle={job.equipment_name}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={t.primary} />}
      >
        <PortalHero eyebrow="MAINTENANCE REQUEST" title={`Job #${job.id}`} subtitle={`${job.equipment_name} · ${job.facility_name}`} Icon={BriefcaseBusiness} />
        <Surface style={{ marginTop: 14 }}>
          <Text style={{ color: t.text, fontSize: 14, lineHeight: 21 }}>{job.description}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
            <StatusChip status={job.status} size="sm" />
            <RiskChip risk={job.risk_level} size="sm" />
            <Chip size="sm">{job.urgency.replace(/_/g, ' ')}</Chip>
          </View>
          {job.assignment ? (
            <View style={{ marginTop: 14, padding: 12, borderRadius: 13, backgroundColor: t.tint }}>
              <Text style={{ color: t.primary, fontSize: 12, fontWeight: '800' }}>Assigned to {job.assignment.technician_name}</Text>
              {job.assignment.override_warning ? (
                <Text style={{ color: t.text, fontSize: 11, marginTop: 5 }}>Capability override recorded: {job.assignment.override_reason || 'No reason provided.'}</Text>
              ) : null}
            </View>
          ) : null}
        </Surface>

        {job.equipment_drift_warnings?.length ? (
          <>
            <Section title="Equipment trend warnings" />
            <Surface style={{ gap: 9 }}>
              {job.equipment_drift_warnings.map((warning, index) => (
                <Text key={`${warning.metric}-${index}`} style={{ color: t.warn, fontSize: 12, fontWeight: '700' }}>
                  {warning.metric}: {warning.direction}
                </Text>
              ))}
            </Surface>
          </>
        ) : null}

        <Section title="Schedule" />
        <Surface style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <IconBadge Icon={CalendarClock} size={40} tone="info" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.sub, fontSize: 11 }}>Currently planned for</Text>
              <Text style={{ color: t.text, fontSize: 13, fontWeight: '700', marginTop: 3 }}>
                {scheduledDate && isValid(scheduledDate) ? format(scheduledDate, 'MMM d, yyyy · h:mm a') : 'No date set'}
              </Text>
            </View>
          </View>
          <Input
            label="Change date and time"
            value={scheduleValue}
            onChangeText={(value) => { setScheduleValue(value); setScheduleError(''); }}
            placeholder="YYYY-MM-DDTHH:mm"
            helperText="Use local time; leave blank to keep the current schedule."
          />
          {scheduleError ? <Text style={{ color: t.bad, fontSize: 12 }}>{scheduleError}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 9 }}>
            <Button style={{ flex: 1 }} disabled={!scheduleValue.trim() || scheduleMutation.isPending} loading={scheduleMutation.isPending} onPress={saveSchedule}>Save schedule</Button>
            {job.scheduled_for ? (
              <Button variant="outline" disabled={scheduleMutation.isPending} onPress={() => scheduleMutation.mutate(null)}>Clear date</Button>
            ) : null}
          </View>
        </Surface>

        <Section title="Required capabilities" />
        <Surface style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          {job.required_capabilities.length ? job.required_capabilities.map((requirement, index) => (
            <Chip key={`${requirement.capability_type}-${String(requirement.key)}-${index}`} size="sm">
              {requirement.capability_type.replace(/_/g, ' ')}: {String(requirement.key).replace(/_/g, ' ')}
            </Chip>
          )) : <Text style={{ color: t.sub, fontSize: 12 }}>No specific capabilities required.</Text>}
        </Surface>

        {!job.assignment && job.status === 'open' ? (
          <>
            <Section title="Technician matches" />
            {matchesQuery.isLoading ? <State loading /> : matchesQuery.isError ? <State error onRetry={() => { void matchesQuery.refetch(); }} /> : (
              <View style={{ gap: 9 }}>
                {(matchesQuery.data ?? []).map((match) => (
                  <Surface key={match.technician_id} style={{ gap: 9 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 9 }}>
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text style={{ color: t.text, fontSize: 13, fontWeight: '800' }}>{match.name}</Text>
                        <Text style={{ color: t.sub, fontSize: 11 }}>{match.contractor || 'Independent technician'} · Score {Math.round(match.score)}</Text>
                      </View>
                      <Chip variant={match.is_qualified ? 'success' : 'warning'} size="xs">{match.is_qualified ? 'Qualified' : 'Review'}</Chip>
                    </View>
                    {!match.is_qualified && match.missing_requirements.length ? (
                      <Text style={{ color: t.warn, fontSize: 11 }}>
                        Missing: {match.missing_requirements.map((requirement) => `${requirement.capability_type}: ${String(requirement.key)}`).join(', ')}
                      </Text>
                    ) : null}
                    <Button variant={match.is_qualified ? 'primary' : 'outline'} disabled={assignMutation.isPending} loading={assignMutation.isPending && assignMutation.variables?.technicianId === match.technician_id} onPress={() => handleAssign(match)}>
                      {match.is_qualified ? 'Assign technician' : 'Assign anyway'}
                    </Button>
                  </Surface>
                ))}
                {!matchesQuery.data?.length ? <Surface><State empty="No available technicians were found for this job." /></Surface> : null}
              </View>
            )}
          </>
        ) : null}

        {job.status !== 'open' ? (
          <>
            <Section title="Service reports" />
            {reportsQuery.isLoading ? <State loading /> : reportsQuery.isError ? <State error onRetry={() => { void reportsQuery.refetch(); }} /> : reports.length ? (
              <View style={{ gap: 10 }}>
                {reports.map((report) => (
                  <Surface key={report.id} style={{ gap: 9 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <Text style={{ color: t.text, fontSize: 13, fontWeight: '800' }}>Report #{report.id} · {report.technician_name}</Text>
                      <StatusChip status={report.status} size="sm" />
                    </View>
                    <Text style={{ color: t.sub, fontSize: 12 }}><Text style={{ color: t.text, fontWeight: '700' }}>Fault: </Text>{report.fault_description}</Text>
                    <Text style={{ color: t.sub, fontSize: 12 }}><Text style={{ color: t.text, fontWeight: '700' }}>Summary: </Text>{report.summary}</Text>
                    <Text style={{ color: t.sub, fontSize: 11 }}>
                      Refrigerant ({report.refrigerant_code}): +{report.refrigerant_added_kg} kg added · {report.refrigerant_recovered_kg} kg recovered
                    </Text>
                    <Text style={{ color: t.sub, fontSize: 11 }}>Leak test: {report.leak_test_result} · Vacuum: {report.vacuum_result}</Text>
                    {report.photos.length ? <Text style={{ color: t.sub, fontSize: 11 }}>{report.photos.length} attached photo{report.photos.length === 1 ? '' : 's'}</Text> : null}
                    <Button variant="outline" leftIcon={<Download size={16} color={t.primary} />} loading={pdfMutation.isPending && pdfMutation.variables === report.id} disabled={pdfMutation.isPending} onPress={() => pdfMutation.mutate(report.id)}>
                      Download PDF
                    </Button>
                    {report.status === 'submitted' ? (
                      <View style={{ flexDirection: 'row', gap: 9 }}>
                        <Button style={{ flex: 1 }} leftIcon={<FileCheck2 size={16} color="#FFFFFF" />} disabled={approveMutation.isPending || rejectMutation.isPending} onPress={() => confirmReportAction(report, 'approve')}>Approve</Button>
                        <Button variant="outline" disabled={approveMutation.isPending || rejectMutation.isPending} onPress={() => confirmReportAction(report, 'reject')}>Return</Button>
                      </View>
                    ) : null}
                  </Surface>
                ))}
              </View>
            ) : <Surface><State empty="No service reports have been submitted for this job." /></Surface>}
          </>
        ) : null}

        {job.status === 'completed' && job.assignment ? (
          <>
            <Section title={`Feedback for ${job.assignment.technician_name}`} />
            <Surface style={{ gap: 12 }}>
              {job.feedback ? (
                <>
                  <View style={{ flexDirection: 'row', gap: 5 }}>
                    {Array.from({ length: 5 }, (_, index) => <Star key={index} size={20} color={index < job.feedback!.rating ? t.warn : t.line} fill={index < job.feedback!.rating ? t.warn : 'transparent'} />)}
                  </View>
                  {job.feedback.comment ? <Text style={{ color: t.sub, fontSize: 12 }}>{job.feedback.comment}</Text> : <Text style={{ color: t.sub, fontSize: 12 }}>No comment provided.</Text>}
                </>
              ) : (
                <>
                  <Text style={{ color: t.sub, fontSize: 12 }}>Rate the completed work.</Text>
                  <View style={{ flexDirection: 'row', gap: 9 }}>
                    {Array.from({ length: 5 }, (_, index) => {
                      const value = index + 1;
                      return (
                        <Pressable key={value} accessibilityRole="button" accessibilityLabel={`${value} star${value === 1 ? '' : 's'}`} onPress={() => setRating(value)}>
                          <Star size={26} color={value <= rating ? t.warn : t.line} fill={value <= rating ? t.warn : 'transparent'} />
                        </Pressable>
                      );
                    })}
                  </View>
                  <Input label="Comment (optional)" value={feedbackComment} onChangeText={setFeedbackComment} multiline maxLength={500} placeholder="Share a note about the work" />
                  <Button disabled={!rating || feedbackMutation.isPending} loading={feedbackMutation.isPending} onPress={() => feedbackMutation.mutate()}>Submit feedback</Button>
                </>
              )}
            </Surface>
          </>
        ) : null}

        {mutationError ? <Text style={{ color: t.bad, fontSize: 12, marginTop: 12 }}>{getApiErrorMessage(mutationError, 'The operation failed. Please try again.')}</Text> : null}
      </ScrollView>

      <Modal visible={!!overrideTarget} transparent animationType="fade" onRequestClose={() => setOverrideTarget(null)}>
        <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <Surface style={{ gap: 12 }}>
            <Text style={{ color: t.text, fontSize: 16, fontWeight: '800' }}>Assign despite missing qualifications?</Text>
            <Text style={{ color: t.warn, fontSize: 12, lineHeight: 18 }}>
              {overrideTarget?.name} is missing required verified capabilities. This exception will be recorded for audit.
            </Text>
            <TextInput
              value={overrideReason}
              onChangeText={setOverrideReason}
              placeholder="Required reason for override"
              placeholderTextColor={t.sub}
              multiline
              style={{ minHeight: 88, textAlignVertical: 'top', borderWidth: 1, borderColor: t.line, borderRadius: 12, padding: 12, color: t.text, backgroundColor: t.field }}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 9 }}>
              <Button variant="outline" onPress={() => { setOverrideTarget(null); setOverrideReason(''); }}>Cancel</Button>
              <Button
                variant="primary"
                loading={assignMutation.isPending}
                disabled={!overrideReason.trim() || assignMutation.isPending}
                onPress={() => {
                  if (overrideTarget) assignMutation.mutate({ technicianId: overrideTarget.technician_id, override: true, reason: overrideReason.trim() });
                }}
              >
                Record override
              </Button>
            </View>
          </Surface>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
