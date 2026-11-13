import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJob, fetchJobMatches, fetchMyTechnicianProfile, assignJob } from '@/src/api/endpoints';
import { JobMatch } from '@/src/types/api';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { Card, CardHeader, CardContent } from '@/src/components/ui/Card';
import { Chip, RiskChip, StatusChip } from '@/src/components/ui/Chip';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { format } from 'date-fns';
import { useAuth } from '@/src/auth/AuthContext';
import { Palette, useTheme } from '@/src/theme/ThemeProvider';
import { State } from '@/src/components/ui/kit';

export default function JobDetailScreen() {
  const { t } = useTheme();
  const styles = createStyles(t);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const jobId = Number(id);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTechnician, setSelectedTechnician] = useState<JobMatch | null>(null);
  const [overrideWarning, setOverrideWarning] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  const { data: job, isLoading, error, refetch } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => fetchJob(jobId),
    enabled: !!jobId,
  });

  const technician = useQuery({
    queryKey: ['my-technician'],
    queryFn: fetchMyTechnicianProfile,
    enabled: user?.role === 'technician',
  });

  const matchesQuery = useQuery({
    queryKey: ['job-matches', jobId],
    queryFn: () => fetchJobMatches(jobId),
    enabled: !!jobId && job?.status === 'open',
  });
  const matches = matchesQuery.data ?? [];

  const assignMutation = useMutation({
    mutationFn: ({ technicianId, overrideWarning, overrideReason }: { technicianId: number; overrideWarning: boolean; overrideReason: string }) =>
      assignJob(jobId, technicianId, overrideWarning, overrideReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      queryClient.invalidateQueries({ queryKey: ['technician-jobs'] });
      setShowAssignModal(false);
      setSelectedTechnician(null);
      setOverrideWarning(false);
      setOverrideReason('');
      Alert.alert('Success', 'Job assigned successfully');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to assign job');
    },
  });

  const handleAssign = () => {
    if (!selectedTechnician) return;
    assignMutation.mutate({
      technicianId: selectedTechnician.technician_id,
      overrideWarning,
      overrideReason,
    });
  };

  const canAssign = user?.role === 'facility_manager' || user?.role === 'contractor_manager' || user?.role === 'admin';
  const isAssignedToMe = job?.assignment?.technician === technician.data?.id;

  if (isLoading) {
    return (
      <ScreenContainer headerTitle="Job detail" showProfile={false}>
        <State loading />
      </ScreenContainer>
    );
  }

  if (error || !job) {
    return (
      <ScreenContainer headerTitle="Job detail" showProfile={false}>
        {error ? <State error onRetry={() => { void refetch(); }} /> : <State empty="Job not found." />}
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer headerTitle={`Job #${job.id}`} showProfile={false}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status & Risk Header */}
        <Card style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Status</Text>
              <StatusChip status={job.status} size="md" />
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Risk Level</Text>
              <RiskChip risk={job.risk_level} size="md" />
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Urgency</Text>
              <Chip variant="default" size="md">{job.urgency}</Chip>
            </View>
          </View>
        </Card>

        {/* Equipment & Facility */}
        <Card style={styles.sectionCard}>
          <CardHeader title="Equipment & Facility" />
          <CardContent>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Equipment</Text>
                <Text style={styles.infoValue}>{job.equipment_name}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Facility</Text>
                <Text style={styles.infoValue}>{job.facility_name}</Text>
              </View>
            </View>
            {job.scheduled_for && (
              <View style={styles.infoRow}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Scheduled</Text>
                  <Text style={styles.infoValue}>{format(new Date(job.scheduled_for), 'MMM d, yyyy HH:mm')}</Text>
                </View>
              </View>
            )}
          </CardContent>
        </Card>

        {/* Description */}
        <Card style={styles.sectionCard}>
          <CardHeader title="Description" />
          <CardContent>
            <Text style={styles.description}>{job.description}</Text>
          </CardContent>
        </Card>

        {/* Required Capabilities */}
        <Card style={styles.sectionCard}>
          <CardHeader title="Required Capabilities" />
          <CardContent>
            {job.required_capabilities.length === 0 ? (
              <Text style={{ color: t.sub, fontSize: 12 }}>No specific capabilities required</Text>
            ) : (
              <View style={styles.capabilityList}>
                {job.required_capabilities.map((cap, i) => (
                  <View key={i} style={styles.capabilityItem}>
                    <Chip variant="info" size="sm">{cap.capability_type}</Chip>
                    <Text style={styles.capabilityText}>
                      {typeof cap.key === 'string' ? cap.key : String(cap.key)}
                      {cap.reason && <Text style={styles.capabilityReason}> — {cap.reason}</Text>}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </CardContent>
        </Card>

        {/* Drift Warnings */}
        {job.equipment_drift_warnings.length > 0 && (
          <Card style={styles.sectionCard}>
            <CardHeader title="⚠️ Drift Warnings" />
            <CardContent>
              <View style={styles.driftList}>
                {job.equipment_drift_warnings.map((dw, i) => (
                  <View key={i} style={styles.driftItem}>
                    <Text style={styles.driftMetric}>{dw.metric}</Text>
                    <Text style={styles.driftDirection}>
                      {dw.direction === 'increasing' ? '📈' : '📉'} {dw.direction} over last 3 services
                    </Text>
                    <Text style={styles.driftValues}>Values: {dw.values.join(', ')}</Text>
                  </View>
                ))}
              </View>
            </CardContent>
          </Card>
        )}

        {/* Assignment */}
        <Card style={styles.sectionCard}>
          <CardHeader title="Assignment" />
          <CardContent>
            {job.assignment ? (
              <View style={styles.assignmentInfo}>
                <View style={styles.assignmentRow}>
                  <Text style={styles.assignmentLabel}>Assigned To</Text>
                  <Text style={styles.assignmentValue}>{job.assignment.technician_name}</Text>
                </View>
                <View style={styles.assignmentRow}>
                  <Text style={styles.assignmentLabel}>Assigned By</Text>
                  <Text style={styles.assignmentValue}>User #{job.assignment.assigned_by}</Text>
                </View>
                <View style={styles.assignmentRow}>
                  <Text style={styles.assignmentLabel}>Assigned At</Text>
                  <Text style={styles.assignmentValue}>{format(new Date(job.assignment.assigned_at), 'MMM d, yyyy HH:mm')}</Text>
                </View>
                {job.assignment.override_warning && (
                  <View style={styles.overrideBanner}>
                    <Text style={styles.overrideLabel}>⚠️ Override Warning</Text>
                    <Text style={styles.overrideReason}>{job.assignment.override_reason}</Text>
                  </View>
                )}
                {isAssignedToMe && job.status !== 'completed' && (
                  <Button fullWidth variant="primary" style={styles.actionButton} onPress={() => router.push(`/app/technician/jobs/${job.id}/report`)}>
                    Submit Service Report
                  </Button>
                )}
              </View>
            ) : (
              canAssign && job.status === 'open' && (
                <View>
                  <Text style={styles.noAssignment}>Unassigned — Select a technician</Text>
                  <Button fullWidth variant="primary" style={styles.actionButton} onPress={() => setShowAssignModal(true)}>
                    Assign Technician
                  </Button>
                </View>
              )
            )}
            {!canAssign && !job.assignment && (
              <Text style={{ color: t.sub, textAlign: 'center', paddingVertical: 16 }}>Waiting for assignment...</Text>
            )}
          </CardContent>
        </Card>

        {/* Matches (for assignment) */}
        {canAssign && job.status === 'open' && !job.assignment && matches.length > 0 && (
          <Card style={styles.sectionCard}>
            <CardHeader title="Available Technicians (Ranked)" />
            <CardContent>
              <View style={styles.matchesList}>
                {matches.slice(0, 5).map((match) => (
                  <TouchableOpacity
                    key={match.technician_id}
                    style={[
                      styles.matchItem,
                      match.is_qualified ? styles.matchQualified : styles.matchUnqualified,
                    ]}
                    onPress={() => setSelectedTechnician(match)}
                  >
                    <View style={styles.matchMain}>
                      <View style={styles.matchScore}>
                        <Text style={styles.matchScoreValue}>{match.score}%</Text>
                        <Text style={styles.matchScoreLabel}>Match</Text>
                      </View>
                      <View style={styles.matchInfo}>
                        <Text style={styles.matchName}>{match.name}</Text>
                        <Text style={styles.matchContractor}>{match.contractor || 'No contractor'}</Text>
                      </View>
                      <View style={styles.matchStatus}>
                        {match.is_qualified ? (
                          <Chip variant="success" size="sm">Qualified</Chip>
                        ) : (
                          <Chip variant="danger" size="sm">Missing Requirements</Chip>
                        )}
                        {canAssign && job.status === 'open' && !job.assignment && matchesQuery.isError ? (
                          <View style={{ marginBottom: 16 }}><State error onRetry={() => { void matchesQuery.refetch(); }} /></View>
                        ) : null}
                      </View>
                    </View>
                    {!match.is_qualified && match.missing_requirements.length > 0 && (
                      <View style={styles.matchMissing}>
                        <Text style={styles.matchMissingLabel}>Missing:</Text>
                        <View style={styles.matchMissingTags}>
                          {match.missing_requirements.slice(0, 3).map((mr, i) => (
                            <Chip key={i} variant="danger" size="xs">
                              {typeof mr.key === 'string' ? mr.key : String(mr.key)}
                            </Chip>
                          ))}
                        </View>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </CardContent>
          </Card>
        )}

        {/* Feedback */}
        {job.feedback && (
          <Card style={styles.sectionCard}>
            <CardHeader title="Feedback" />
            <CardContent>
              <View style={styles.feedback}>
                <View style={styles.rating}>
                  {[...Array(5)].map((_, i) => (
                    <Text key={i} style={styles.star}>
                      {i < job.feedback!.rating ? '★' : '☆'}
                    </Text>
                  ))}
                </View>
                <Text style={styles.feedbackComment}>{job.feedback.comment}</Text>
              </View>
            </CardContent>
          </Card>
        )}
      </ScrollView>

      {/* Assign Modal */}
      {showAssignModal && selectedTechnician && (
        <View style={styles.modalOverlay} onTouchStart={() => {}}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Job</Text>
              <TouchableOpacity onPress={() => setShowAssignModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalContent}>
              <Text style={styles.modalTechnician}>{selectedTechnician.name}</Text>
              <Text style={styles.modalScore}>Match Score: {selectedTechnician.score}%</Text>
              
              {!selectedTechnician.is_qualified && (
                <View style={styles.modalWarning}>
                  <Text style={styles.modalWarningText}>⚠️ This technician is missing required verified capabilities:</Text>
                  <View style={styles.modalMissingList}>
                    {selectedTechnician.missing_requirements.map((mr, i) => (
                      <Chip key={i} variant="danger" size="sm">
                        {typeof mr.key === 'string' ? mr.key : String(mr.key)}
                        {mr.reason && ` — ${mr.reason}`}
                      </Chip>
                    ))}
                  </View>
                  <View style={styles.overrideSection}>
                    <TouchableOpacity onPress={() => setOverrideWarning(!overrideWarning)} style={styles.checkboxRow}>
                      <View style={[
                        styles.checkbox,
                        overrideWarning && styles.checkboxChecked,
                      ]}>
                        {overrideWarning && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <Text style={styles.checkboxLabel}>I understand the risk and want to proceed (override)</Text>
                    </TouchableOpacity>
                    {overrideWarning && (
                      <Input
                        label="Override Reason (required)"
                        placeholder="Explain why this assignment is necessary..."
                        value={overrideReason}
                        onChangeText={setOverrideReason}
                        multiline
                        numberOfLines={3}
                        style={styles.overrideInput}
                      />
                    )}
                  </View>
                </View>
              )}

              <View style={styles.modalActions}>
                <Button variant="outline" onPress={() => setShowAssignModal(false)}>Cancel</Button>
                <Button
                  variant={overrideWarning || selectedTechnician.is_qualified ? 'primary' : 'secondary'}
                  onPress={handleAssign}
                  loading={assignMutation.isPending}
                  disabled={!selectedTechnician.is_qualified && !overrideWarning}
                >
                  Assign
                </Button>
              </View>
            </View>
          </View>
        </View>
      )}
    </ScreenContainer>
  );
}

import { router } from 'expo-router';

const createStyles = (t: Palette) => StyleSheet.create({
  scrollContent: { paddingBottom: 100 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statusCard: { marginBottom: 16 },
  statusRow: { flexDirection: 'row', gap: 12 },
  statusItem: { flex: 1 },
  statusLabel: { fontSize: 11, color: t.sub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  sectionCard: { marginBottom: 16 },
  infoRow: { flexDirection: 'row', gap: 16 },
  infoItem: { flex: 1 },
  infoLabel: { fontSize: 11, color: t.sub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  infoValue: { fontSize: 14, fontWeight: '500', color: t.text },
  description: { fontSize: 14, color: t.text, lineHeight: 22 },
  capabilityList: { gap: 8 },
  capabilityItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  capabilityText: { flex: 1, fontSize: 13, color: t.text },
  capabilityReason: { fontSize: 12, color: t.sub },
  driftList: { gap: 12 },
  driftItem: { padding: 12, backgroundColor: t.warnBg, borderRadius: 12, borderWidth: 1, borderColor: t.warn },
  driftMetric: { fontSize: 13, fontWeight: '600', color: t.warn, marginBottom: 4 },
  driftDirection: { fontSize: 13, color: t.warn, marginBottom: 2 },
  driftValues: { fontSize: 12, color: t.warn, fontFamily: 'monospace' },
  assignmentInfo: { gap: 8 },
  assignmentRow: { flexDirection: 'row', justifyContent: 'space-between' },
  assignmentLabel: { fontSize: 13, color: t.sub },
  assignmentValue: { fontSize: 13, fontWeight: '500', color: t.text },
  overrideBanner: { marginTop: 12, padding: 12, backgroundColor: t.badBg, borderRadius: 12, borderWidth: 1, borderColor: t.bad },
  overrideLabel: { fontSize: 12, fontWeight: '600', color: t.bad, marginBottom: 4 },
  overrideReason: { fontSize: 12, color: t.bad },
  actionButton: { marginTop: 12 },
  noAssignment: { fontSize: 14, color: t.sub, textAlign: 'center', marginBottom: 12 },
  matchesList: { gap: 8 },
  matchItem: { padding: 12, borderRadius: 8, borderWidth: 1 },
  matchQualified: { backgroundColor: t.okBg, borderColor: t.ok },
  matchUnqualified: { backgroundColor: t.badBg, borderColor: t.bad },
  matchMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  matchScore: { alignItems: 'center', paddingHorizontal: 8 },
  matchScoreValue: { fontSize: 18, fontWeight: '700', color: t.ok },
  matchScoreLabel: { fontSize: 10, color: t.ok },
  matchInfo: { flex: 1 },
  matchName: { fontSize: 14, fontWeight: '600', color: t.text },
  matchContractor: { fontSize: 12, color: t.sub },
  matchStatus: { marginLeft: 8 },
  matchMissing: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: t.bad },
  matchMissingLabel: { fontSize: 11, color: t.bad, fontWeight: '600', marginBottom: 6 },
  matchMissingTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  feedback: { gap: 8 },
  rating: { flexDirection: 'row', gap: 2 },
  star: { fontSize: 20, color: t.warn },
  feedbackComment: { fontSize: 14, color: t.text, fontStyle: 'italic' },
  modalOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modal: { backgroundColor: t.card, borderRadius: 20, width: '100%', maxWidth: 400, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: t.line },
  modalTitle: { fontSize: 18, fontWeight: '700', color: t.text },
  modalClose: { fontSize: 24, color: t.sub },
  modalContent: { padding: 16, gap: 12 },
  modalTechnician: { fontSize: 18, fontWeight: '700', color: t.text },
  modalScore: { fontSize: 14, color: t.sub },
  modalWarning: { padding: 12, backgroundColor: t.badBg, borderRadius: 12, borderWidth: 1, borderColor: t.bad, gap: 8 },
  modalWarningText: { fontSize: 13, color: t.bad, fontWeight: '600' },
  modalMissingList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  overrideSection: { marginTop: 8, gap: 8 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: { width: 20, height: 20, borderWidth: 2, borderColor: t.line, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: t.bad, borderColor: t.bad },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  checkboxLabel: { fontSize: 13, color: t.text, flex: 1 },
  overrideInput: { marginTop: 4 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8, justifyContent: 'flex-end' },
});