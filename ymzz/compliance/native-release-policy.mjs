// MIT. Decisions, not waivers. The caller executes the fresh on-disk verifier.
export function deriveReleaseDecision(nodePassed,native){
 const inspected=native?.packagedNativePayloadInspected===true&&native?.actualRootsVerified===true;
 const source=native?.correspondingSourceMaterialsVerified===true;
 const rights=native?.nativeRightsVerified===true&&native?.nativeCoverageComplete===true;
 const nativeGate=native?.nativeGatePassed===true&&inspected&&source&&rights&&Array.isArray(native?.holds)&&native.holds.length===0;
 const missing=[];
 if(!nodePassed)missing.push('Actual Node dependency policy or resolution failed');
 if(!inspected)missing.push('Current complete on-disk native inventory/ASAR binding not verified');
 if(!source)missing.push('Exact active LGPL/MPL corresponding-source/relink archives not verified');
 if(!rights)missing.push('Actual native original grants/notices, known hash coverage or redistribution conditions unresolved');
 if(!nativeGate&&!missing.length)missing.push('Native verifier reported an unresolved hold');
 return {packagedNativePayloadInspected:inspected,correspondingSourceMaterialsVerified:source,nativeRightsVerified:rights,missingEvidence:missing,releaseCleared:nodePassed===true&&nativeGate};
}
