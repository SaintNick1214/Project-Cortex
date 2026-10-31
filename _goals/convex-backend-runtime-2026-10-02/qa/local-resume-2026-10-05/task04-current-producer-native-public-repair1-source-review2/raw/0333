"""Future fixed native source entry. This file has not been executed natively."""
import json
from pathlib import Path
import sys
import traceback

from strict_io import Reader, read_materializer, strict_json, require
from native_boundary import NativeBoundary, PHASE_ROOT
from producers import produce_current


def main():
    require(sys.argv[1:] == [], 'NO_ARBITRARY_CANONICAL_PRODUCER_ARGV')
    reader = Reader()
    base = Path(PHASE_ROOT)
    def load(path):
        proof, raw = reader.read(str(path), 67108864)
        return strict_json(raw), {k: v for k, v in proof.items() if k != 'EOF'}
    binding, binding_pin = load(base/'bindings/current-canonical-producer-binding.json')
    release, release_pin = load(base/'bindings/current-canonical-producer-release.json')
    request, _ = load(base/'bindings/current-canonical-producer-request.json')
    contract, contract_pin = load(base/'tools/reference-contract.json')
    authority = NativeBoundary(binding, release, binding_pin, release_pin)
    primary = None
    try:
        reader.final(); authority.verify()
        result = produce_current(request, contract, authority)
        print(json.dumps(result, separators=(',', ':')))
    except BaseException as error:
        primary = error
        # External reviewed controller must retain stdout/stderr and any partial
        # owned outputs. No successful/enabling receipt is emitted on this path.
        print(json.dumps({'scope':'FAILED_CURRENT_SOURCE_PRODUCTION_NOT_QUALIFICATION',
                          'type':type(error).__name__,'message':str(error),'ROOT':'ABSENT',
                          'original122':'HELD','traceback':traceback.format_exc()}),file=sys.stderr)
        raise
    finally:
        try: authority.close()
        except BaseException as close_error:
            if primary is not None: primary.add_note('SECONDARY_CURRENT_BOUNDARY_CLOSE:' + str(close_error))
            else: raise


if __name__ == '__main__': main()
