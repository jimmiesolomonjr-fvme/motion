import Input, { Textarea } from '../ui/Input';

export default function StepProfile({ profile, setProfile, onNext, onBack }) {
  const handleChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const isValid = profile.displayName && profile.age && profile.city;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Build Your Profile</h2>
        <p className="text-gray-400">Let people know who you are</p>
      </div>

      <div className="space-y-4">
        <Input
          label="Display Name"
          name="displayName"
          value={profile.displayName}
          onChange={handleChange}
          placeholder="What should people call you?"
        />

        <Input
          label="Age"
          name="age"
          type="number"
          min="18"
          max="99"
          value={profile.age}
          onChange={handleChange}
          placeholder="Must be 18+"
        />

        <Input
          label="City"
          name="city"
          value={profile.city}
          onChange={handleChange}
          placeholder="e.g. Atlanta, GA"
        />

        <Textarea
          label="Bio"
          name="bio"
          value={profile.bio}
          onChange={handleChange}
          placeholder="Tell people about yourself..."
          maxLength={300}
        />

        <Input
          label="Looking For"
          name="lookingFor"
          value={profile.lookingFor}
          onChange={handleChange}
          placeholder="e.g. Something serious, good vibes..."
        />
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="btn-outline flex-1">Back</button>
        <button onClick={onNext} disabled={!isValid} className={`btn-gold flex-1 ${!isValid ? 'opacity-50 cursor-not-allowed' : ''}`}>
          Continue
        </button>
      </div>
    </div>
  );
}
