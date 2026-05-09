from pydantic import BaseModel, ConfigDict, Field, computed_field
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid

class ChecklistItem(BaseModel):
    id: str
    status: str = Field(pattern="^(PASS|FAIL|NOT_APPLICABLE)$")
    description: str
    evidence: Optional[str] = None

class SACItem(BaseModel):
    id: str
    description: str
    status: str = Field(pattern="^(MET|NOT_MET)$")
    
class Finding(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    file_path: str
    line_number: Optional[int] = None
    evidence: str
    masvs_id: str
    mastg_test: str
    impact: int = Field(ge=1, le=3)
    exploitability: int = Field(ge=1, le=3)
    exposure: int = Field(ge=1, le=3)
    remediation: str
    false_positive_probability: float = Field(default=0.0, ge=0.0, le=1.0)
    
    @computed_field
    def score(self) -> int:
        return self.impact * self.exploitability * self.exposure
        
    @computed_field
    def severity(self) -> str:
        s = self.score
        if s >= 18:
            return "critical"
        elif s >= 9:
            return "major"
        else:
            return "minor"

class AuditReport(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    apk_hash: str
    apk_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    findings: List[Finding] = []
    masvs_coverage: Dict[str, float] = {}  # e.g., {"MASVS-AUTH": 0.85}
    masvs_mapping: Dict[str, Any] = {}     # Résultat du Compliance Mapper
    checklist: List[ChecklistItem] = []
    sac_items: List[SACItem] = []
    executive_summary: str = ""
    
    @computed_field
    def overall_score(self) -> float:
        if not self.findings:
            return 100.0
        # Simple scoring logic: detract points for each finding based on severity
        penalty = 0
        for f in self.findings:
            if f.severity == "critical":
                penalty += 15
            elif f.severity == "major":
                penalty += 5
            else:
                penalty += 1
        return max(0.0, 100.0 - penalty)
