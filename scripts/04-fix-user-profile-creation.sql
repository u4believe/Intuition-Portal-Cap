-- Create a function that ensures user profile exists
CREATE OR REPLACE FUNCTION ensure_user_profile(user_id UUID, user_email TEXT)
RETURNS UUID AS $$
DECLARE
  existing_id UUID;
BEGIN
  -- Check if user profile already exists
  SELECT id INTO existing_id FROM user_profiles WHERE id = user_id;
  
  IF existing_id IS NULL THEN
    -- Create the user profile if it doesn't exist
    INSERT INTO user_profiles (id, email) VALUES (user_id, user_email)
    ON CONFLICT (id) DO NOTHING;
  END IF;
  
  RETURN user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION ensure_user_profile(UUID, TEXT) TO authenticated;
