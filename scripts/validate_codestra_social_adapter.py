from pathlib import Path

CLIENT = Path('integrations/codestra-social/client.ts')


def main() -> None:
    text = CLIENT.read_text(encoding='utf-8')
    lower = text.lower()
    assert 'authorization' in lower and 'bearer' in lower
    assert 'x-correlation-id' in lower
    assert 'method: "get"' in lower
    assert 'social_publishing_disabled' in lower
    assert 'publish_not_implemented_until_stage5_approval' in lower
    assert 'method: "post"' not in lower, 'runtime adapter must remain read-only during certification'
    assert 'facebook.com' not in lower and 'graph.facebook.com' not in lower
    print('SOCIAL_RUNTIME_ADAPTER_STAGE5_CERTIFICATION=PASS')


if __name__ == '__main__':
    main()
