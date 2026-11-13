import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.contractors.models import ContractorCompany
from apps.core.choices import ContractorVerificationStatus, EquipmentCategory, Criticality
from apps.core.models import RefrigerantType
from apps.facilities.models import Equipment, Facility
from apps.technicians.models import TechnicianProfile


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def refrigerants(db):
    return {
        "R-134a": RefrigerantType.objects.create(code="R-134a", name="R-134a", gwp=1430),
        "R-32": RefrigerantType.objects.create(code="R-32", name="R-32", gwp=675, is_a2l=True),
        "R-717": RefrigerantType.objects.create(code="R-717", name="Ammonia", gwp=0, is_ammonia=True),
        "R-744": RefrigerantType.objects.create(code="R-744", name="CO2", gwp=1, is_high_pressure=True),
    }


@pytest.fixture
def facility_manager(db):
    user = User.objects.create_user(
        username="fm", email="fm@test.local", password="pass12345", role=User.Role.FACILITY_MANAGER
    )
    return user


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        username="admin", email="admin@test.local", password="pass12345",
        role=User.Role.ADMIN, is_staff=True,
    )


@pytest.fixture
def facility(db, facility_manager):
    return Facility.objects.create(
        owner=facility_manager, name="Test Facility", address="1 Test St",
        service_area="Testville", segment=Facility.Segment.COLD_STORAGE,
    )


@pytest.fixture
def contractor(db, facility_manager):
    manager = User.objects.create_user(
        username="cm", email="cm@test.local", password="pass12345", role=User.Role.CONTRACTOR_MANAGER
    )
    return ContractorCompany.objects.create(
        manager=manager, name="Test Contractor", service_area="Testville",
        verification_status=ContractorVerificationStatus.VERIFIED,
    )


@pytest.fixture
def technician(db, contractor):
    user = User.objects.create_user(
        username="tech", email="tech@test.local", password="pass12345", role=User.Role.TECHNICIAN
    )
    return TechnicianProfile.objects.create(
        user=user, contractor=contractor, service_area="Testville", years_experience=5, available=True
    )


def make_equipment(facility, refrigerant, category=EquipmentCategory.COMMERCIAL_CHILLER, criticality=Criticality.MEDIUM):
    return Equipment.objects.create(
        facility=facility, name=f"{category}-unit", category=category,
        refrigerant_type=refrigerant, criticality=criticality,
    )
