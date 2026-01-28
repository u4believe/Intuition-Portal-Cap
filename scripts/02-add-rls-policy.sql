-- Add INSERT policy for user_profiles to allow users to create their own profile
CREATE POLICY "Users can create their own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
