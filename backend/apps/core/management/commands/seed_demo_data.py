import datetime
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import User
from apps.assessments.models import Assessment, AssessmentQuestion
from apps.contractors.models import ContractorCompany, ContractorDocument
from apps.core.choices import (
    CapabilityStatus,
    CapabilityType,
    ContractorVerificationStatus,
    CredentialStatus,
    Criticality,
    EquipmentCategory,
    EvidenceType,
    SafetyDomain,
    Urgency,
)
from apps.core.models import RefrigerantType
from apps.facilities.models import Equipment, Facility
from apps.jobs.services.risk import classify
from apps.jobs.models import JobRequest
from apps.servicereports.models import CylinderTransaction, RefrigerantCylinder
from apps.technicians.models import CapabilitySkill, Credential, TechnicianProfile, WorkHistoryEntry

ASSESSMENTS = [
    dict(
        title="Ammonia Safety Fundamentals",
        capability_type=CapabilityType.SAFETY,
        safety_domain=SafetyDomain.AMMONIA_SAFETY,
        pass_score_percent=75,
        questions=[
            dict(
                prompt="Ammonia (R-717) is primarily a hazard to technicians because it is:",
                choices=["Flammable only above 60°C", "Toxic and corrosive at low concentrations", "Radioactive", "Odorless, making leaks hard to detect"],
                correct_index=1,
            ),
            dict(
                prompt="Before opening an ammonia system for service, a technician should first:",
                choices=["Increase system pressure to purge air", "Isolate and pump down the section, confirming zero pressure", "Disable the alarm system to avoid false triggers", "Vent the section directly into the room"],
                correct_index=1,
            ),
            dict(
                prompt="Which PPE is minimally required for ammonia system service?",
                choices=["Standard cotton gloves only", "Chemical splash goggles and an ammonia-rated respirator", "Sunglasses and ear protection", "No special PPE if the system is small"],
                correct_index=1,
            ),
            dict(
                prompt="An ammonia leak alarm activates near the plant room. The correct first action is:",
                choices=["Continue working, alarms are frequently false", "Evacuate to a safe distance and follow the site's ammonia emergency plan", "Open all doors and windows manually before leaving", "Attempt to locate the leak source without PPE"],
                correct_index=1,
            ),
        ],
    ),
    dict(
        title="CO2 High-Pressure Operation",
        capability_type=CapabilityType.SAFETY,
        safety_domain=SafetyDomain.CO2_HIGH_PRESSURE,
        pass_score_percent=75,
        questions=[
            dict(
                prompt="Transcritical CO2 (R-744) systems typically operate at pressures that are:",
                choices=["Lower than standard HFC systems", "Similar to standard HFC systems", "Substantially higher than standard HFC systems", "Always below atmospheric pressure"],
                correct_index=2,
            ),
            dict(
                prompt="Gauges and recovery equipment used on a CO2 system must be:",
                choices=["The same as used for any HFC refrigerant", "Rated for CO2's higher working pressure", "Rated for vacuum service only", "Not required, standard tools are sufficient"],
                correct_index=1,
            ),
            dict(
                prompt="A CO2 system's high-side pressure spikes well above normal on a hot day. This is:",
                choices=["A sign of a refrigerant leak only", "Expected transcritical behavior that still needs monitoring against system limits", "Irrelevant to technician safety", "Only a concern for ammonia systems"],
                correct_index=1,
            ),
        ],
    ),
    dict(
        title="A2L Refrigerant Handling",
        capability_type=CapabilityType.SAFETY,
        safety_domain=SafetyDomain.A2L_SAFETY,
        pass_score_percent=75,
        questions=[
            dict(
                prompt="A2L refrigerants (e.g. R-32, R-454B) are classified as:",
                choices=["Non-flammable, low toxicity", "Mildly flammable, low toxicity", "Highly flammable, high toxicity", "Non-flammable, high toxicity"],
                correct_index=1,
            ),
            dict(
                prompt="When brazing near an A2L system, a technician should:",
                choices=["Ignore refrigerant charge, brazing heat is unrelated", "Recover refrigerant and ensure the area is free of ignition sources per the system's charge limits", "Only worry about ignition sources for ammonia systems", "Vent the refrigerant into the room before brazing"],
                correct_index=1,
            ),
            dict(
                prompt="Compared to standard HFCs, A2L refrigerant leak detection equipment should be:",
                choices=["Identical, no special consideration needed", "Rated/calibrated for flammable refrigerant detection", "Unnecessary since A2Ls have a strong odor", "Only required outdoors"],
                correct_index=1,
            ),
        ],
    ),
]

REFRIGERANTS = [
    dict(code="R-32", name="R-32", gwp=675, is_a2l=True),
    dict(code="R-410A", name="R-410A", gwp=2088),
    dict(code="R-134a", name="R-134a", gwp=1430),
    dict(code="R-404A", name="R-404A", gwp=3922),
    dict(code="R-744", name="CO2 (R-744)", gwp=1, is_high_pressure=True),
    dict(code="R-717", name="Ammonia (R-717)", gwp=0, is_ammonia=True),
    dict(code="R-454B", name="R-454B", gwp=466, is_a2l=True),
]

today = timezone.now().date()


class Command(BaseCommand):
    help = "Seed demo facility/contractor/technician data for the HVAC/R platform."

    def handle(self, *args, **options):
        refrigerants = self._seed_refrigerants()
        facility_manager = self._seed_facility_manager()
        admin = self._seed_admin()
        facility, equipment = self._seed_facility(facility_manager, refrigerants)
        contractor = self._seed_contractor(refrigerants)
        technicians = self._seed_technicians(contractor, refrigerants, admin)
        self._seed_jobs(facility_manager, facility, equipment)
        self._seed_assessments()
        self._seed_cylinders(contractor, refrigerants)

        self.stdout.write(self.style.SUCCESS("Demo data seeded."))
        self.stdout.write("Login credentials (password 'demopass123' for all):")
        self.stdout.write(f"  Facility manager: {facility_manager.email}")
        self.stdout.write(f"  Contractor manager: {contractor.manager.email}")
        for t in technicians:
            self.stdout.write(f"  Technician: {t.user.email}")
        self.stdout.write(f"  Admin (Django Admin login): {admin.email} / demopass123")

    def _seed_refrigerants(self):
        out = {}
        for data in REFRIGERANTS:
            obj, _ = RefrigerantType.objects.update_or_create(code=data["code"], defaults=data)
            out[data["code"]] = obj
        return out

    def _seed_facility_manager(self):
        user, created = User.objects.get_or_create(
            email="fm@demo.local",
            defaults=dict(first_name="Fatima", last_name="Manager", role=User.Role.FACILITY_MANAGER),
        )
        if created:
            user.set_password("demopass123")
            user.save()
        return user

    def _seed_admin(self):
        user, created = User.objects.get_or_create(
            email="admin@demo.local",
            defaults=dict(
                first_name="Site", last_name="Admin", role=User.Role.ADMIN, is_staff=True, is_superuser=True
            ),
        )
        if created:
            user.set_password("demopass123")
            user.save()
        return user

    def _seed_facility(self, owner, refrigerants):
        facility, _ = Facility.objects.get_or_create(
            owner=owner,
            name="Coldline Distribution Center",
            defaults=dict(
                segment=Facility.Segment.COLD_STORAGE,
                address="42 Industrial Ave, Mumbai",
                service_area="Mumbai",
                contact_name="Fatima Manager",
                contact_phone="+91-9800000001",
            ),
        )

        equipment_specs = [
            dict(name="Cold Room Chiller A", category=EquipmentCategory.COMMERCIAL_CHILLER,
                 refrigerant="R-134a", capacity="50 TR", charge_kg="45.00", criticality=Criticality.HIGH),
            dict(name="Frozen Storage Unit 1", category=EquipmentCategory.COLD_STORAGE_UNIT,
                 refrigerant="R-404A", capacity="30 TR", charge_kg="35.00", criticality=Criticality.CRITICAL),
            dict(name="Supermarket Rack B", category=EquipmentCategory.SUPERMARKET_REFRIGERATION,
                 refrigerant="R-32", capacity="15 TR", charge_kg="18.00", criticality=Criticality.MEDIUM),
            dict(name="Ammonia Plant Room", category=EquipmentCategory.AMMONIA_SYSTEM,
                 refrigerant="R-717", capacity="100 TR", charge_kg="250.00", criticality=Criticality.CRITICAL),
            dict(name="CO2 Booster System", category=EquipmentCategory.CO2_REFRIGERATION,
                 refrigerant="R-744", capacity="40 TR", charge_kg="60.00", criticality=Criticality.HIGH),
        ]
        equipment = []
        for spec in equipment_specs:
            obj, _ = Equipment.objects.get_or_create(
                facility=facility,
                name=spec["name"],
                defaults=dict(
                    category=spec["category"],
                    refrigerant_type=refrigerants[spec["refrigerant"]],
                    capacity=spec["capacity"],
                    refrigerant_charge_kg=spec["charge_kg"],
                    criticality=spec["criticality"],
                    install_date=today - datetime.timedelta(days=800),
                ),
            )
            if obj.refrigerant_charge_kg is None:
                obj.refrigerant_charge_kg = spec["charge_kg"]
                obj.save(update_fields=["refrigerant_charge_kg"])
            equipment.append(obj)
        return facility, equipment

    def _seed_contractor(self, refrigerants):
        manager, created = User.objects.get_or_create(
            email="contractor@demo.local",
            defaults=dict(first_name="Rahul", last_name="Contractor", role=User.Role.CONTRACTOR_MANAGER),
        )
        if created:
            manager.set_password("demopass123")
            manager.save()

        company, _ = ContractorCompany.objects.get_or_create(
            manager=manager,
            name="CoolTech Services Pvt Ltd",
            defaults=dict(
                registration_number="CTS-2019-4821",
                service_area="Mumbai",
                response_time_commitment="4 hours",
                verification_status=ContractorVerificationStatus.VERIFIED,
            ),
        )
        ContractorDocument.objects.get_or_create(
            company=company,
            doc_type=ContractorDocument.DocType.INSURANCE,
            defaults=dict(file="contractor_documents/demo-insurance.pdf", status=ContractorDocument.Status.VERIFIED),
        )
        return company

    def _seed_technicians(self, contractor, refrigerants, admin):
        specs = [
            dict(
                email="tech.senior@demo.local", first_name="Arjun", last_name="Senior", years=9,
                capabilities=[
                    (CapabilityType.EQUIPMENT, EquipmentCategory.COMMERCIAL_CHILLER, EvidenceType.WORK_HISTORY, CapabilityStatus.VERIFIED),
                    (CapabilityType.REFRIGERANT, "R-32", EvidenceType.CREDENTIAL, CapabilityStatus.VERIFIED),
                    (CapabilityType.SAFETY, SafetyDomain.A2L_SAFETY, EvidenceType.PRACTICAL_ASSESSMENT, CapabilityStatus.VERIFIED),
                    (CapabilityType.EQUIPMENT, EquipmentCategory.CO2_REFRIGERATION, EvidenceType.PRACTICAL_ASSESSMENT, CapabilityStatus.VERIFIED),
                    (CapabilityType.SAFETY, SafetyDomain.CO2_HIGH_PRESSURE, EvidenceType.PRACTICAL_ASSESSMENT, CapabilityStatus.VERIFIED),
                    (CapabilityType.SAFETY, SafetyDomain.REFRIGERANT_RECOVERY, EvidenceType.EMPLOYER_CONFIRMATION, CapabilityStatus.VERIFIED),
                    (CapabilityType.SAFETY, SafetyDomain.ELECTRICAL_DIAGNOSTICS, EvidenceType.PRACTICAL_ASSESSMENT, CapabilityStatus.PENDING),
                ],
                credentials=[("EPA Section 608 Universal", CredentialStatus.PLATFORM_VERIFIED, 700)],
            ),
            dict(
                email="tech.mid@demo.local", first_name="Priya", last_name="Midlevel", years=4,
                capabilities=[
                    (CapabilityType.EQUIPMENT, EquipmentCategory.SUPERMARKET_REFRIGERATION, EvidenceType.WORK_HISTORY, CapabilityStatus.VERIFIED),
                    (CapabilityType.REFRIGERANT, "R-404A", EvidenceType.WORK_HISTORY, CapabilityStatus.VERIFIED),
                    (CapabilityType.SAFETY, SafetyDomain.LEAK_DETECTION, EvidenceType.EMPLOYER_CONFIRMATION, CapabilityStatus.VERIFIED),
                    (CapabilityType.EQUIPMENT, EquipmentCategory.AMMONIA_SYSTEM, EvidenceType.NONE, CapabilityStatus.NOT_QUALIFIED),
                    (CapabilityType.SAFETY, SafetyDomain.AMMONIA_SAFETY, EvidenceType.NONE, CapabilityStatus.NOT_QUALIFIED),
                ],
                credentials=[("EPA Section 608 Type II", CredentialStatus.PLATFORM_VERIFIED, 365)],
            ),
            dict(
                email="tech.junior@demo.local", first_name="Sameer", last_name="Junior", years=1,
                capabilities=[
                    (CapabilityType.EQUIPMENT, EquipmentCategory.COLD_STORAGE_UNIT, EvidenceType.WORK_HISTORY, CapabilityStatus.PENDING),
                    (CapabilityType.REFRIGERANT, "R-134a", EvidenceType.NONE, CapabilityStatus.PENDING),
                ],
                credentials=[("EPA Section 608 Type I", CredentialStatus.PENDING, None)],
            ),
        ]

        technicians = []
        for spec in specs:
            user, created = User.objects.get_or_create(
                email=spec["email"],
                defaults=dict(first_name=spec["first_name"], last_name=spec["last_name"], role=User.Role.TECHNICIAN),
            )
            if created:
                user.set_password("demopass123")
                user.save()

            profile, _ = TechnicianProfile.objects.get_or_create(
                user=user,
                defaults=dict(contractor=contractor, service_area="Mumbai", years_experience=spec["years"], available=True),
            )
            if profile.contractor_id is None:
                profile.contractor = contractor
                profile.years_experience = spec["years"]
                profile.save()

            for cap_type, key, evidence, status in spec["capabilities"]:
                kwargs = dict(technician=profile, capability_type=cap_type, evidence_type=evidence, status=status)
                if status == CapabilityStatus.VERIFIED:
                    kwargs.update(verified_by=admin, verified_at=timezone.now())
                if cap_type == CapabilityType.EQUIPMENT:
                    CapabilitySkill.objects.get_or_create(
                        technician=profile, capability_type=cap_type, equipment_category=key,
                        refrigerant_type=None, safety_domain="", defaults=kwargs,
                    )
                elif cap_type == CapabilityType.REFRIGERANT:
                    CapabilitySkill.objects.get_or_create(
                        technician=profile, capability_type=cap_type, equipment_category="",
                        refrigerant_type=refrigerants[key], safety_domain="", defaults=kwargs,
                    )
                else:
                    CapabilitySkill.objects.get_or_create(
                        technician=profile, capability_type=cap_type, equipment_category="",
                        refrigerant_type=None, safety_domain=key, defaults=kwargs,
                    )

            for name, status, expiry_days in spec["credentials"]:
                Credential.objects.get_or_create(
                    technician=profile, name=name,
                    defaults=dict(
                        issuer_name="EPA / National Certifying Body",
                        credential_number=f"CRED-{user.id}-{name[:4].upper()}",
                        issue_date=today - datetime.timedelta(days=365),
                        expiry_date=today + datetime.timedelta(days=expiry_days) if expiry_days else None,
                        file="credentials/demo-credential.pdf",
                        status=status,
                        reviewed_by=admin if status != CredentialStatus.PENDING else None,
                        reviewed_at=timezone.now() if status != CredentialStatus.PENDING else None,
                    ),
                )

            WorkHistoryEntry.objects.get_or_create(
                technician=profile,
                equipment_category=spec["capabilities"][0][1] if spec["capabilities"][0][0] == CapabilityType.EQUIPMENT else EquipmentCategory.COMMERCIAL_CHILLER,
                date=today - datetime.timedelta(days=90),
                defaults=dict(description="Routine maintenance and diagnostics.", refrigerant_type=refrigerants["R-134a"]),
            )

            technicians.append(profile)
        return technicians

    @staticmethod
    def _at(days_ahead, hour):
        """A moment `days_ahead` days from now at `hour`:00 local time, so the demo calendar always has upcoming work."""
        moment = timezone.localtime(timezone.now()) + datetime.timedelta(days=days_ahead)
        return moment.replace(hour=hour, minute=0, second=0, microsecond=0)

    def _seed_jobs(self, facility_manager, facility, equipment):
        ammonia_equipment = next(e for e in equipment if e.category == EquipmentCategory.AMMONIA_SYSTEM)
        risk_level, required_capabilities, _ = classify(ammonia_equipment, Urgency.URGENT)
        urgent_job, _ = JobRequest.objects.get_or_create(
            facility=facility,
            equipment=ammonia_equipment,
            created_by=facility_manager,
            description="Ammonia plant room showing high discharge pressure alarm, needs diagnostics.",
            defaults=dict(
                urgency=Urgency.URGENT,
                risk_level=risk_level,
                required_capabilities=required_capabilities,
                scheduled_for=self._at(1, 9),
            ),
        )

        chiller_equipment = next(e for e in equipment if e.category == EquipmentCategory.COMMERCIAL_CHILLER)
        risk_level, required_capabilities, _ = classify(chiller_equipment, Urgency.SCHEDULED)
        scheduled_job, _ = JobRequest.objects.get_or_create(
            facility=facility,
            equipment=chiller_equipment,
            created_by=facility_manager,
            description="Scheduled preventive maintenance for cold room chiller.",
            defaults=dict(
                urgency=Urgency.SCHEDULED,
                risk_level=risk_level,
                required_capabilities=required_capabilities,
                scheduled_for=self._at(4, 14),
            ),
        )

        # Existing demo databases pre-date scheduling: give the jobs a date once.
        for job, days_ahead, hour in ((urgent_job, 1, 9), (scheduled_job, 4, 14)):
            if job.scheduled_for is None:
                job.scheduled_for = self._at(days_ahead, hour)
                job.save(update_fields=["scheduled_for"])

    def _seed_assessments(self):
        for spec in ASSESSMENTS:
            assessment, _ = Assessment.objects.get_or_create(
                title=spec["title"],
                defaults=dict(
                    capability_type=spec["capability_type"],
                    safety_domain=spec.get("safety_domain", ""),
                    equipment_category=spec.get("equipment_category", ""),
                    pass_score_percent=spec["pass_score_percent"],
                ),
            )
            for order, q in enumerate(spec["questions"]):
                AssessmentQuestion.objects.get_or_create(
                    assessment=assessment,
                    prompt=q["prompt"],
                    defaults=dict(choices=q["choices"], correct_index=q["correct_index"], order=order),
                )

    def _seed_cylinders(self, contractor, refrigerants):
        specs = [
            ("CT-134A-01", "R-134a", RefrigerantCylinder.Kind.SUPPLY, "13.60", "12.00"),
            ("CT-134A-REC", "R-134a", RefrigerantCylinder.Kind.RECOVERY, "20.00", "2.00"),
            ("CT-404A-01", "R-404A", RefrigerantCylinder.Kind.SUPPLY, "10.00", "0.80"),  # nearly empty: shows the low-cylinder alert
        ]
        for serial, code, kind, capacity, current in specs:
            cylinder, created = RefrigerantCylinder.objects.get_or_create(
                company=contractor, serial_number=serial,
                defaults=dict(
                    refrigerant_type=refrigerants[code], kind=kind,
                    capacity_kg=Decimal(capacity), current_kg=Decimal(current),
                ),
            )
            if created:
                CylinderTransaction.objects.create(
                    cylinder=cylinder, kind=CylinderTransaction.Kind.INITIAL_FILL,
                    amount_kg=cylinder.current_kg, balance_after_kg=cylinder.current_kg,
                )
