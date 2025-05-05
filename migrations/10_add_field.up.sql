CREATE TABLE audit_log (
    id UUID PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    action VARCHAR(64) NOT NULL,
    target_id UUID, -- ID của đối tượng bị tác động (ví dụ: quote_id)
    workspace_id UUID NOT NULL,
    metadata JSONB, -- Thông tin bổ sung (nếu cần)
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);