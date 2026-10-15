# Rewards and gameplay deployment

Start command: `npm start` (runs `node game-server.cjs`).
Required runtime: Node.js 22 or newer.

In DigitalOcean App Platform, add `SUPABASE_SERVICE_ROLE_KEY` as an encrypted RUN_TIME environment variable containing the Supabase secret/server key for project rubtdmmdxjvforydjjcn. Never commit it, put it in frontend code, or paste it into chat.

Without that variable, earned coins are not credited to Supabase and rewardStatus is disabled. With it, the backend calls settle_race_reward, retries failures, and marks a reward saved only after a valid database response. Each player/race settles once; bots never receive wallet payouts.

Settlement jobs and active rooms are in memory. Unacknowledged rewards do NOT survive backend restarts. Do not describe pending rewards as saved or promise restart-safe delivery. Database-confirmed payouts survive restarts and duplicate submissions do not credit twice.

Health reports rewardsConfigured (configuration present, not proof that the key works), pendingRewards, and pendingRewardsSurviveRestart=false. Verify a real finished race and a wallet reload before announcing rewards live.

Frontend must display rewardStatus and reload the profile after settlement. Existing prototype labels require a separate frontend update. Purchases and rematches are not enabled by this commit.
