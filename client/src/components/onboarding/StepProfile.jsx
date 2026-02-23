import { useState } from 'react';
import Input, { Textarea } from '../ui/Input';
import LocationAutocomplete from '../ui/LocationAutocomplete';
import { HEIGHT_FEET, HEIGHT_INCHES, WEIGHT_OPTIONS, OCCUPATION_OPTIONS } from '../../utils/constants';

export default function StepProfile({ profile, setProfile, onNext, onBack }) {
  const [customOccupation, setCustomOccupation] = useState('');

  const handleChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  // Parse height string like "5'10\"" back into feet/inches
  const parseHeight = () => {
    const match = profile.height?.match(/^(\d)'(\d{1,2})"$/);
    if (match) return { feet: match[1], inches: match[2] };
    return { feet: '', inches: '' };
  };

  const { feet, inches } = parseHeight();

  const handleHeightChange = (part, value) => {
    const newFeet = part === 'feet' ? value : feet;
    const newInches = part === 'inches' ? value : inches;
    if (newFeet && newInches !== '') {
      setProfile({ ...profile, height: `${newFeet}'${newInches}"` });
    } else if (newFeet || newInches !== '') {
      // Partial — store what we have
      const partial = newFeet ? `${newFeet}'${newInches || 0}"` : '';
      setProfile({ ...profile, height: partial });
    } else {
      setProfile({ ...profile, height: '' });
    }
  };

  const handleWeightChange = (value) => {
    setProfile({ ...profile, weight: value ? `${value} lbs` : '' });
  };

  const handleOccupationChange = (value) => {
    if (value === 'Other') {
      setProfile({ ...profile, occupation: customOccupation || '' });
    } else {
      setProfile({ ...profile, occupation: value });
      setCustomOccupation('');
    }
  };

  // Parse weight back for select
  const weightNum = profile.weight?.replace(' lbs', '') || '';

  // Determine if occupation is a custom value
  const isCustomOccupation = profile.occupation && !OCCUPATION_OPTIONS.includes(profile.occupation);
  const occupationSelect = isCustomOccupation ? 'Other' : (profile.occupation || '');

  const bioCharsNeeded = 50 - (profile.bio?.length || 0);
  const isValid = profile.displayName && profile.age && profile.city && (profile.bio?.length || 0) >= 50;

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

        <LocationAutocomplete
          label="City"
          name="city"
          value={profile.city}
          onChange={handleChange}
          placeholder="e.g. Atlanta, GA"
        />

        {/* Height & Weight side by side */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Height</label>
            <div className="flex gap-1.5">
              <select
                value={feet}
                onChange={(e) => handleHeightChange('feet', e.target.value)}
                className="flex-1 input-field py-2.5 text-sm"
              >
                <option value="">ft</option>
                {HEIGHT_FEET.map((f) => (
                  <option key={f} value={f}>{f}ft</option>
                ))}
              </select>
              <select
                value={inches}
                onChange={(e) => handleHeightChange('inches', e.target.value)}
                className="flex-1 input-field py-2.5 text-sm"
              >
                <option value="">in</option>
                {HEIGHT_INCHES.map((i) => (
                  <option key={i} value={i}>{i}in</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Weight</label>
            <select
              value={weightNum}
              onChange={(e) => handleWeightChange(e.target.value)}
              className="w-full input-field py-2.5 text-sm"
            >
              <option value="">Select</option>
              {WEIGHT_OPTIONS.map((w) => (
                <option key={w} value={w}>{w} lbs</option>
              ))}
            </select>
          </div>
        </div>

        {/* Occupation */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Occupation</label>
          <select
            value={occupationSelect}
            onChange={(e) => handleOccupationChange(e.target.value)}
            className="w-full input-field py-2.5 text-sm"
          >
            <option value="">Select occupation</option>
            {OCCUPATION_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
          {(occupationSelect === 'Other' || isCustomOccupation) && (
            <input
              value={isCustomOccupation ? profile.occupation : customOccupation}
              onChange={(e) => {
                setCustomOccupation(e.target.value);
                setProfile({ ...profile, occupation: e.target.value });
              }}
              placeholder="Enter your occupation"
              className="w-full input-field py-2.5 text-sm mt-2"
              maxLength={50}
            />
          )}
        </div>

        {/* Bio with character count */}
        <div>
          <Textarea
            label="Bio"
            name="bio"
            value={profile.bio}
            onChange={handleChange}
            placeholder="Tell people about yourself..."
            maxLength={300}
          />
          <p className={`text-xs mt-1 ${bioCharsNeeded > 0 ? 'text-gold/70' : 'text-gray-500'}`}>
            {profile.bio?.length || 0}/300
            {bioCharsNeeded > 0 && ` (${bioCharsNeeded} more needed)`}
          </p>
        </div>
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
