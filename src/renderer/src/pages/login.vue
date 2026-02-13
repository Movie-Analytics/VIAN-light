<template>
  <v-container max-width="600">
    <div class="my-10">
      <h1 class="mb-3 text-center text-h1">
        {{ $t('pages.login.appTitle') }}
      </h1>

      <p>
        {{ $t('pages.login.description') }}
      </p>

      <ul class="ms-5 mt-1">
        <li>{{ $t('pages.login.features.shotboundary') }}</li>

        <li>{{ $t('pages.login.features.elan') }}</li>

        <li>{{ $t('pages.login.features.screenshots') }}</li>

        <li>{{ $t('pages.login.features.electronBrowser') }}</li>
      </ul>
    </div>

    <v-card>
      <v-tabs v-model="tab" show-arrows>
        <v-tab value="login">
          {{ $t('pages.login.tabs.login') }}
        </v-tab>

        <v-tab value="signup">
          {{ $t('pages.login.tabs.signup') }}
        </v-tab>
      </v-tabs>

      <v-card-text>
        <v-tabs-window v-model="tab">
          <!-- LOGIN -->
          <v-tabs-window-item value="login">
            <v-form>
              <v-text-field
                v-model="email"
                :label="$t('pages.login.form.email')"
                :rules="mailRule"
                required
              ></v-text-field>

              <v-text-field
                v-model="password"
                :label="$t('pages.login.form.password')"
                type="password"
                :rules="lengthRule"
                required
              ></v-text-field>
            </v-form>

            <v-btn block class="ma-1" @click="login">
              {{ $t('pages.login.actions.login') }}
            </v-btn>
          </v-tabs-window-item>

          <!-- SIGNUP -->
          <v-tabs-window-item value="signup">
            <v-form>
              <v-text-field
                v-model="email"
                :label="$t('pages.login.form.email')"
                :rules="mailRule"
                required
              ></v-text-field>

              <v-text-field
                v-model="password"
                :label="$t('pages.login.form.password')"
                type="password"
                :rules="lengthRule"
                required
              ></v-text-field>
            </v-form>

            <v-btn block class="ma-1" @click="signup">
              {{ $t('pages.login.actions.signup') }}
            </v-btn>
          </v-tabs-window-item>
        </v-tabs-window>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script>
import { mapStores } from 'pinia'
import { useTempStore } from '@renderer/stores/temp'

export default {
  name: 'Login',

  data: () => ({
    email: '',
    lengthRule: [(v) => v && v.length > 3],
    mailRule: [(v) => v && v.length > 3 && v.indexOf('@') >= 0],
    password: '',
    tab: null
  }),

  computed: {
    ...mapStores(useTempStore)
  },

  methods: {
    async login() {
      if (await this.tempStore.login(this.email, this.password)) this.$router.push('/')
    },

    async signup() {
      if (await this.tempStore.signup(this.email, this.password)) this.$router.push('/')
    }
  }
}
</script>
