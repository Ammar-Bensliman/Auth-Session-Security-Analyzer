import xml.etree.ElementTree as ET
from typing import List, Dict

class ManifestParser:
    def __init__(self, manifest_path: str):
        self.manifest_path = manifest_path
        self.tree = ET.parse(manifest_path)
        self.root = self.tree.getroot()
        # Namespace Android
        self.ns = {'android': 'http://schemas.android.com/apk/res/android'}

    def get_package_name(self) -> str:
        return self.root.attrib.get("package", "")
        
    def get_permissions(self) -> List[str]:
        permissions = []
        for elem in self.root.findall('uses-permission'):
            perm = elem.attrib.get('v{http://schemas.android.com/apk/res/android}name') or elem.attrib.get('{http://schemas.android.com/apk/res/android}name')
            if perm:
                permissions.append(perm)
        return permissions

    def get_exported_activities(self) -> List[Dict[str, str]]:
        activities = []
        app = self.root.find('application')
        if app is None: return []
        
        for activity in app.findall('activity'):
            exported = activity.attrib.get('{http://schemas.android.com/apk/res/android}exported')
            name = activity.attrib.get('{http://schemas.android.com/apk/res/android}name')
            if exported == 'true':
                activities.append({"name": name, "exported": True})
        return activities
