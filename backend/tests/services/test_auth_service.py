from app.core.security import hash_password, verify_password, create_access_token, verify_token


def test_password_hash_and_verify():
    hashed = hash_password("mypassword")
    assert verify_password("mypassword", hashed)
    assert not verify_password("wrongpassword", hashed)


def test_create_and_verify_token():
    token = create_access_token("test-user-id", ["LENDER"])
    payload = verify_token(token)
    assert payload["sub"] == "test-user-id"
    assert "LENDER" in payload["roles"]


def test_verify_invalid_token():
    payload = verify_token("invalid.token.here")
    assert payload == {}
