"""Use the pinned Mozilla CA bundle for explicit model downloads on every OS."""
import ssl


def download_context():
    import certifi
    return ssl.create_default_context(cafile=certifi.where())
