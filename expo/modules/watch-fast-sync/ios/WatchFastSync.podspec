Pod::Spec.new do |s|
  s.name           = 'WatchFastSync'
  s.version        = '1.0.0'
  s.summary        = 'App Group + WatchConnectivity sync for Daniel Fast Calculator'
  s.homepage       = 'https://github.com/ChristianAppsFamily/daniel-fast-calculator'
  s.license        = 'MIT'
  s.author         = 'Christian App Empire'
  s.source         = { :path => '.' }
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source_files   = '**/*.{swift}'
  s.dependency       'ExpoModulesCore'
end
